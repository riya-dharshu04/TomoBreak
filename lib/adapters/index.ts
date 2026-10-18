/**
 * Site adapters: tiny watchers that notice coding results on specific sites
 * and tell the service worker, which may send a celebration.
 *
 * Privacy: adapters only look for result text (e.g. "Accepted"), never
 * read or send anything else from the page.
 *
 * To add a site, create one file exporting a SiteAdapter and list it below.
 */
import type { AdapterEvent } from '@/utils/types';
import { githubAdapter } from './github';
import { leetcodeAdapter } from './leetcode';

export interface SiteAdapter {
  id: string;
  /** Hostnames this adapter runs on (subdomains included). */
  hosts: readonly string[];
  /** Start watching; returns a function that stops and cleans up. */
  start(emit: (event: AdapterEvent) => void): () => void;
}

export const ADAPTERS: readonly SiteAdapter[] = [leetcodeAdapter, githubAdapter];

export function adapterFor(hostname: string): SiteAdapter | null {
  const host = hostname.toLowerCase();
  return ADAPTERS.find((adapter) => adapter.hosts.some((h) => host === h || host.endsWith(`.${h}`))) ?? null;
}
