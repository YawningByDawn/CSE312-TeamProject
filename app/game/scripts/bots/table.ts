/**
 * The balance table (BALANCE.md): N seeded runs per bot on the rebuilt sim, split over worker threads of this one
 * process, each bounded by its heap cap. Seeds 1..N; a run is a pure function of seed and bot, so the table is the same
 * on any worker count.
 *
 *   python tools/bots.py -- [seeds=500] [bots=all|decent,cautious,random] [--workers=3] [--md]
 */
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { BOT_IDS, playRun, table, type BotId, type RunResult } from './play';

type Job = [BotId, number];

if (!isMainThread) {
  for (const [bot, seed] of workerData as Job[]) parentPort!.postMessage(playRun(seed, bot));
} else {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const n = Number(pos[0] ?? 500);
  const bots = (pos[1] && pos[1] !== 'all' ? pos[1].split(',') : BOT_IDS) as BotId[];
  const workers = Number(args.find((a) => a.startsWith('--workers='))?.slice(10) ?? 3);
  const md = args.includes('--md');
  const t0 = Date.now();
  const jobs: Job[] = [];
  for (let seed = 1; seed <= n; seed++) for (const bot of bots) jobs.push([bot, seed]);
  const parts: Job[][] = Array.from({ length: Math.min(workers, jobs.length) }, () => []);
  jobs.forEach((j, i) => parts[i % parts.length]!.push(j));
  const runs: RunResult[] = [];
  await Promise.all(parts.map((part) => new Promise<void>((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: part, resourceLimits: { maxOldGenerationSizeMb: 768 } });
    w.on('message', (r: RunResult) => {
      runs.push(r);
      if (runs.length % 50 === 0) console.error(`${runs.length} / ${jobs.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    });
    w.on('error', reject);
    w.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))));
  })));
  console.log(table(bots, runs, md));
  console.log(`\n${n} seeds × ${bots.length} bots in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
