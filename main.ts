// EMBER VAULT — the hand-in program (Node 22, standard library only).
//
// The game is the game/ folder beside this file: plain static files a
// desktop browser opens offline (game/index.html plus its modules, no
// library, no network request). This program hands the entry in. It stages
// game/ and screenshots/ into the output folder and writes dossier.json
// there — the summary the judge reads — with the vendored make.fun
// library. The grader's container uses /output; anywhere else the
// MAKEFUN_OUTPUT_DIR variable stands in for it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The folder this file sits in: the repository root. */
const repoRoot = dirname(fileURLToPath(import.meta.url));

/** Where the entry goes: the grader's /output, or MAKEFUN_OUTPUT_DIR outside it. */
const handInDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * The scorer's caps for this bounty. Only the text cap shapes the
 * dossier's bytes; the rest refuse an entry the scorer would refuse:
 * at most 4 screenshots of 256 KiB each, game/ at most 993 entries and
 * 48 MiB in all, no path under game/ over 1000 bytes. game/ counts
 * against /output's own 1000-entry cap beside screenshots/ and
 * dossier.json, so the game cap is 993 rather than 1000.
 */
const scorerCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

/**
 * Stage one folder of the entry into the output directory: create the
 * destination, then copy the source tree into it when the source exists.
 * The destination is created even when the source folder is absent, so
 * the dossier always finds the folder it expects.
 */
function stageFolder(name: string): void {
  const target = join(handInDir, name);
  mkdirSync(target, { recursive: true });
  const source = join(repoRoot, name);
  if (existsSync(source)) cpSync(source, target, { recursive: true });
}

/** Hand the entry in: stage the game and its screenshots, then write the dossier. */
function handIn(): void {
  mkdirSync(handInDir, { recursive: true });
  stageFolder('game');
  stageFolder('screenshots');
  writeFileSync(join(handInDir, 'dossier.json'), buildDossier(handInDir, scorerCaps));
  const dossierPath = join(handInDir, 'dossier.json');
  console.log(`EMBER VAULT handed in: ${dossierPath} (${statSync(dossierPath).size} bytes)`);
}

handIn();
