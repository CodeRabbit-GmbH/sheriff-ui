import { Injectable } from '@angular/core';

declare global {
  // eslint-disable-next-line no-var
  var __SHERIFF_API_BASE__: string | undefined;
  // eslint-disable-next-line no-var
  var __SHERIFF_INITIAL_CWD__: string | undefined;
  // eslint-disable-next-line no-var
  var __SHERIFF_INITIAL_ENTRY__: string | undefined;
}

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly _isVsCodeWebview: boolean;
  private readonly _apiBaseUrl: string;
  private readonly _initialCwd: string | undefined;
  private readonly _initialEntry: string | undefined;

  constructor() {
    this._isVsCodeWebview = typeof globalThis.__SHERIFF_API_BASE__ !== 'undefined';
    this._apiBaseUrl = globalThis.__SHERIFF_API_BASE__ ?? '';
    this._initialCwd = globalThis.__SHERIFF_INITIAL_CWD__;
    this._initialEntry = globalThis.__SHERIFF_INITIAL_ENTRY__;
  }

  get isVsCodeWebview(): boolean {
    return this._isVsCodeWebview;
  }

  get apiBaseUrl(): string {
    return this._apiBaseUrl;
  }

  get initialCwd(): string | undefined {
    return this._initialCwd;
  }

  get initialEntry(): string | undefined {
    return this._initialEntry;
  }
}

