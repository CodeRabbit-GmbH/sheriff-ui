import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withState, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, pipe, tap, switchMap, from, catchError, of } from 'rxjs';
import { Api } from '../../api/api';
import {
  manualAddTag,
  manualDeleteTagEverywhere,
  manualInit,
  manualInitDefault,
  manualPreview,
  manualRemoveTag,
  manualSave,
  manualToggleDepRule,
} from '../../api/functions';
import type { FolderNode } from '../../module-renderer/+state/models/folder-node';
import { toFolderTreeFromMergedTree } from '../../shared/to-folder-tree-from-merged-tree';
import type { DepRulesForDisplay } from '../../api/models';
import type { NodeIndex } from './models/node-index';
import type { PreviewContext } from '../../api/models';
import { buildIdIndex } from './utils/tree-utils';
import { collectTags } from './utils/dep-rules-utils';
import { EnvironmentService } from '../../core/environment.service';

const STORAGE_KEY_OVERRIDE = 'sheriff-manual-entry-override';
const STORAGE_KEY_OVERRIDDEN_ENTRY = 'sheriff-overridden-entry';

export type ManualTab = 'builder' | 'graph' | 'code';
export type TagTarget = 'selected' | 'module' | string;

const VALIDATION_DEBOUNCE_MS = 800;

export const ManualStore = signalStore(
  { providedIn: 'root' },

  withState({
    cwd: '',
    entry: 'src/main.ts',
    missingConfig: false,
    activeConfigContent: '',
    draft: '',
    draftDirty: false,

    preview: null as PreviewContext | null,
    previewValid: false,
    previewErrors: [] as string[],
    /** Simplified dep rules: from tag → [accessible tags] */
    depRules: {} as DepRulesForDisplay,

    availableEntries: [] as string[],
    manualEntryOverride: false,
    overriddenEntry: '',

    loading: false,
    validating: false,
    saving: false,
    errors: [] as string[],

    tab: 'builder' as ManualTab,
    selectedId: null as string | null,
    selectedFromTag: null as string | null,
    draggingTag: null as string | null,
  }),

  withComputed((store) => {
    const previewTree = computed((): FolderNode | null => {
      const p = store.preview();
      if (!p) return null;
      return toFolderTreeFromMergedTree(p);
    });

    const graphTree = computed(() => previewTree());

    const index = computed((): NodeIndex => buildIdIndex(graphTree()));

    const allTags = computed(() => collectTags(graphTree(), store.depRules()));

    const selectedNode = computed((): FolderNode | null => {
      const id = store.selectedId();
      const idx = index();
      return id ? idx.byId.get(id) ?? null : null;
    });

    const selectedModule = computed((): FolderNode | null => {
      const id = store.selectedId();
      if (!id) return null;
      const { byId, parentById } = index();
      let cur: string | null = id;
      while (cur) {
        const node = byId.get(cur);
        if (node?.isSheriffModule) return node;
        cur = parentById.get(cur) ?? null;
      }
      return null;
    });

    const detectedTagKinds = computed(() => {
      const tags = allTags();
      const kinds = new Set<string>();
      for (const t of tags) {
        const idx = t.indexOf(':');
        if (idx > 0) kinds.add(t.substring(0, idx));
      }
      const sorted = [...kinds].sort();
      if (sorted.length === 0) return ['type', 'domain', 'shared', 'feature', 'scope'];
      return sorted;
    });

    const targetModules = computed(() => {
      const node = selectedNode();
      if (!node) return new Set<string>();

      const depRules = store.depRules();
      const selectedTags = node.tags ?? [];

      const accessibleTags = new Set<string>();
      for (const tag of selectedTags) {
        const canAccess = depRules[tag] ?? [];
        for (const t of canAccess) {
          accessibleTags.add(t);
        }
      }

      const tree = graphTree();
      if (!tree) return new Set<string>();

      const targetIds = new Set<string>();
      const findNodes = (n: FolderNode): void => {
        const nodeTags = n.tags ?? [];
        for (const t of nodeTags) {
          if (accessibleTags.has(t)) {
            targetIds.add(n.id);
            break;
          }
        }
        if (n.children) {
          for (const child of n.children) {
            findNodes(child);
          }
        }
      };
      findNodes(tree);

      return targetIds;
    });

    const tagUsageCount = computed(() => {
      const counts = new Map<string, number>();
      const tree = graphTree();
      if (!tree) return counts;

      const walk = (n: FolderNode): void => {
        if (n.isSheriffModule) {
          for (const t of n.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        for (const c of n.children ?? []) walk(c);
      };

      walk(tree);
      return counts;
    });

    const effectiveEntry = computed(() => {
      if (store.manualEntryOverride()) {
        return store.overriddenEntry() || store.entry();
      }
      return store.entry();
    });

    return { previewTree, graphTree, index, allTags, selectedNode, selectedModule, detectedTagKinds, targetModules, tagUsageCount, effectiveEntry };
  }),

  withMethods((store, env = inject(EnvironmentService)) => {
    if (env.initialCwd && store.cwd() !== env.initialCwd) {
      patchState(store, { cwd: env.initialCwd });
    }
    if (env.initialEntry && store.entry() !== env.initialEntry) {
      patchState(store, { entry: env.initialEntry });
    }

    const storedOverride = localStorage.getItem(STORAGE_KEY_OVERRIDE) === 'true';
    const storedOverriddenEntry = localStorage.getItem(STORAGE_KEY_OVERRIDDEN_ENTRY);
    if (storedOverride) {
      patchState(store, { manualEntryOverride: true });
      if (storedOverriddenEntry) {
        patchState(store, { overriddenEntry: storedOverriddenEntry, entry: storedOverriddenEntry });
      }
    }

    const api = inject(Api);

    const applyPreviewToState = (preview: PreviewContext, draft: string): void => {
      patchState(store, {
        draft,
        draftDirty: false,
        preview,
        previewValid: preview.configValid,
        previewErrors: preview.errors ?? [],
        depRules: preview.depRules ?? {},
        loading: false,
        validating: false,
        errors: [],
      });
    };

    const resolvePathRel = (target: TagTarget): string | null => {
      if (target === 'selected') return store.selectedNode()?.pathRel ?? null;
      if (target === 'module') return store.selectedModule()?.pathRel ?? null;
      return store.index().byId.get(target)?.pathRel ?? null;
    };

    const buildMutationBody = <T extends Record<string, unknown>>(extra: T) =>
      ({
        draft: store.draft(),
        entry: store.effectiveEntry(),
        cwd: store.cwd() || undefined,
        ...extra,
      }) as T & { draft: string; entry: string; cwd?: string };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, errors: [] });
        try {
          const hasUserSelectedEntry = store.manualEntryOverride() || store.availableEntries().length > 0;
          const body: { cwd?: string; entry?: string } = {
            cwd: store.cwd() || undefined,
            entry: hasUserSelectedEntry ? store.effectiveEntry() : undefined,
          };

          const res = await api.invoke(manualInit, { body });

          patchState(store, {
            cwd: res.cwd,
            entry: res.entry,
            missingConfig: res.missingConfig,
            activeConfigContent: res.activeConfigContent,
            availableEntries: res.availableEntries,
          });

          if (res.preview) {
            applyPreviewToState(res.preview, res.draft);
          } else {
            patchState(store, {
              draft: res.draft,
              draftDirty: false,
              preview: null,
              previewValid: false,
              previewErrors: [],
              loading: false,
            });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Init failed';
          patchState(store, { loading: false, errors: [msg] });
        }
      },

      async initDefault(): Promise<void> {
        patchState(store, { loading: true, errors: [] });
        try {
          const body: { cwd?: string; entry?: string } = {
            cwd: store.cwd() || undefined,
            entry: store.effectiveEntry() || undefined,
          };

          const res = await api.invoke(manualInitDefault, { body });

          patchState(store, {
            cwd: res.cwd,
            entry: res.entry,
            missingConfig: res.missingConfig,
            activeConfigContent: res.activeConfigContent,
          });

          if (res.preview) {
            applyPreviewToState(res.preview, res.draft);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Init default failed';
          patchState(store, { loading: false, errors: [msg] });
        }
      },

      async addTag(pathRel: string, tag: string): Promise<void> {
        patchState(store, { loading: true, errors: [] });
        try {
          const res = await api.invoke(manualAddTag, { body: buildMutationBody({ pathRel, tag }) });
          applyPreviewToState(res.preview, res.draft);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Add tag failed';
          patchState(store, { loading: false, errors: [msg] });
        }
      },

      async removeTag(pathRel: string, tag: string): Promise<void> {
        patchState(store, { loading: true, errors: [] });
        try {
          const res = await api.invoke(manualRemoveTag, { body: buildMutationBody({ pathRel, tag }) });
          applyPreviewToState(res.preview, res.draft);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Remove tag failed';
          patchState(store, { loading: false, errors: [msg] });
        }
      },

      async deleteTagEverywhere(tag: string): Promise<void> {
        patchState(store, { loading: true, errors: [] });
        try {
          const res = await api.invoke(manualDeleteTagEverywhere, { body: buildMutationBody({ tag }) });
          applyPreviewToState(res.preview, res.draft);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Delete tag failed';
          patchState(store, { loading: false, errors: [msg] });
        }
      },

      async toggleDepRule(from: string, to: string): Promise<void> {
        patchState(store, { loading: true, errors: [] });
        try {
          const res = await api.invoke(manualToggleDepRule, { body: buildMutationBody({ from, to }) });
          applyPreviewToState(res.preview, res.draft);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Toggle dep rule failed';
          patchState(store, { loading: false, errors: [msg] });
        }
      },

      /**
       * High-level method: Modify a tag on a target (add or remove).
       * Resolves target to pathRel and calls the appropriate command.
       */
      async modifyTag(target: TagTarget, operation: 'add' | 'remove', tag: string): Promise<void> {
        if (typeof target === 'string' && target !== 'selected' && target !== 'module') {
          patchState(store, { selectedId: target });
        }

        const pathRel = resolvePathRel(target);
        if (!pathRel) return;

        if (operation === 'add') {
          await this.addTag(pathRel, tag);
        } else {
          await this.removeTag(pathRel, tag);
        }
      },

      /**
       * High-level method: Toggle a dep rule and regenerate.
       */
      async toggleDepRuleAndRegenerate(from: string, to: string): Promise<void> {
        await this.toggleDepRule(from, to);
      },

      async applyPreview(): Promise<void> {
        const draft = store.draft();
        if (!draft.trim()) {
          patchState(store, { previewValid: false, previewErrors: ['Config is empty'] });
          return;
        }

        patchState(store, { loading: true, errors: [] });

        try {
          const body = { draft, entry: store.effectiveEntry(), cwd: store.cwd() || undefined };
          const res = await api.invoke(manualPreview, { body });
          applyPreviewToState(res, draft);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Preview failed';
          patchState(store, { loading: false, previewValid: false, previewErrors: [msg] });
        }
      },

      async validateDraft(): Promise<void> {
        const draft = store.draft();
        if (!draft.trim()) {
          patchState(store, { previewValid: false, previewErrors: ['Config is empty'], validating: false });
          return;
        }

        patchState(store, { validating: true });

        try {
          const body = { draft, entry: store.effectiveEntry(), cwd: store.cwd() || undefined };
          const res = await api.invoke(manualPreview, { body });
          applyPreviewToState(res, draft);
          patchState(store, { draftDirty: true });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Validation failed';
          patchState(store, { previewValid: false, previewErrors: [msg], validating: false });
        }
      },

      async saveDraftToDisk(): Promise<void> {
        patchState(store, { saving: true, errors: [] });
        try {
          const body = { draft: store.draft(), cwd: store.cwd() || undefined };
          const res = await api.invoke(manualSave, { body });

          if (res.ok === true) {
            patchState(store, {
              activeConfigContent: store.draft(),
              draftDirty: false,
              saving: false,
            });
          } else {
            patchState(store, { saving: false, errors: res.errors ?? ['Save failed'] });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Save failed';
          patchState(store, { saving: false, errors: [msg] });
        }
      },

      setDraft: rxMethod<string>(
        pipe(
          tap((draft) => patchState(store, { draft, draftDirty: true })),
          debounceTime(VALIDATION_DEBOUNCE_MS),
          switchMap(() => {
            const draft = store.draft();
            if (!draft.trim()) {
              patchState(store, { previewValid: false, previewErrors: ['Config is empty'], validating: false });
              return of(null);
            }
            patchState(store, { validating: true });
            const body = { draft, entry: store.effectiveEntry(), cwd: store.cwd() || undefined };
            return from(api.invoke(manualPreview, { body })).pipe(
              tap((res) => {
                applyPreviewToState(res, draft);
                patchState(store, { draftDirty: true });
              }),
              catchError((e: unknown) => {
                const msg = e instanceof Error ? e.message : 'Validation failed';
                patchState(store, { previewValid: false, previewErrors: [msg], validating: false });
                return of(null);
              }),
            );
          }),
        ),
      ),

      setTab(tab: ManualTab): void {
        patchState(store, { tab });
      },

      setSelectedId(id: string | null): void {
        patchState(store, { selectedId: id });
      },

      setSelectedFromTag(tag: string | null): void {
        patchState(store, { selectedFromTag: tag });
      },

      setDraggingTag(tag: string | null): void {
        patchState(store, { draggingTag: tag });
      },

      setCwd(cwd: string): void {
        // Reset entry-related state when switching projects
        // This allows the API to determine the entry from the new project's config
        patchState(store, {
          cwd,
          manualEntryOverride: false,
          overriddenEntry: '',
          availableEntries: [],
          entry: 'src/main.ts',
        });
        localStorage.removeItem(STORAGE_KEY_OVERRIDE);
        localStorage.removeItem(STORAGE_KEY_OVERRIDDEN_ENTRY);
      },

      setEntry(entry: string): void {
        patchState(store, { entry });
      },

      setOverriddenEntry(entry: string): void {
        patchState(store, { overriddenEntry: entry, entry });
        localStorage.setItem(STORAGE_KEY_OVERRIDDEN_ENTRY, entry);
      },

      setManualEntryOverride(override: boolean): void {
        if (override) {
          const currentEntry = store.entry();
          const overriddenEntry = store.overriddenEntry() || currentEntry;
          patchState(store, {
            manualEntryOverride: true,
            overriddenEntry
          });
          localStorage.setItem(STORAGE_KEY_OVERRIDE, 'true');
          localStorage.setItem(STORAGE_KEY_OVERRIDDEN_ENTRY, overriddenEntry);
        } else {
          const entries = store.availableEntries();
          const serverEntry = entries[0] || 'src/main.ts';
          patchState(store, {
            manualEntryOverride: false,
            entry: serverEntry
          });
          localStorage.setItem(STORAGE_KEY_OVERRIDE, 'false');
        }
      },

      /** Select a different entry point (multi-app) and re-init */
      async selectEntry(entryPath: string): Promise<void> {
        const entries = store.availableEntries();
        if (!entries.includes(entryPath)) return;

        patchState(store, { entry: entryPath });
        await this.init();
      },
    };
  }),
);
