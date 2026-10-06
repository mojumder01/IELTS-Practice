// npm run validate: checks every content file against the Zod schemas and the
// SPEC section 8 "Before publishing" rules. Exits 1 on any problem.
import { formatProblems, loadContent, MANIFEST_FILE, VOCAB_FILE } from './content';

const root = process.argv[2] ?? process.cwd();
const content = await loadContent(root);
const clean = (file: string) => !content.problems.some((p) => p.file === file);

for (const { file, test } of content.tests) {
  if (test) console.log(`✓ ${file} (${Object.keys(test.sections).join(', ')})`);
}
if (content.manifest && clean(MANIFEST_FILE)) {
  console.log(`✓ ${MANIFEST_FILE} (${content.manifest.files.length} files)`);
}
if (content.vocab && clean(VOCAB_FILE))
  console.log(`✓ ${VOCAB_FILE} (${content.vocab.length} words)`);

if (content.problems.length) {
  console.error(`\n${formatProblems(content.problems)}\n`);
  const count = content.problems.reduce((n, p) => n + p.issues.length, 0);
  console.error(`${count} problem${count === 1 ? '' : 's'} found.`);
  process.exit(1);
}
