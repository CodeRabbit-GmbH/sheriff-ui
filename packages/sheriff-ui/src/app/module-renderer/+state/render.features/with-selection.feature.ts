import { signalStoreFeature, withState, type, withMethods, patchState } from '@ngrx/signals';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const withSelection = <_>() =>
  signalStoreFeature(
    {
      state: type<{
        collapsed: Set<string>;
      }>(),
    },
    withState({
      selectedId: null as string | null,
      targetModules: new Set<string>(),
      useExternalTargetModules: false,
    }),
    withMethods((store) => ({
      select(id: string) {
        patchState(store, { selectedId: id });
      },
      clearSelection() {
        patchState(store, { selectedId: null, targetModules: new Set<string>() });
      },
      toggleSelected(id: string) {
        const current = store.selectedId();
        const nextId = current === id ? null : id;
        patchState(store, { selectedId: nextId });
        if (!nextId) patchState(store, { targetModules: new Set<string>() });
      },
      toggleCollapsed(id: string) {
        const s = new Set(store.collapsed());
        if (s.has(id)) s.delete(id);
        else s.add(id);
        patchState(store, { collapsed: s });
      },
      setTargetModules(modules: Set<string>) {
        patchState(store, { targetModules: modules, useExternalTargetModules: true });
      },
      setUseExternalTargetModules(value: boolean) {
        patchState(store, { useExternalTargetModules: value });
      },
    })),
  );
