// Imports the Midnight documentation into docs/pages from the repositories that own it.
//
// Every page listed in PAGES is copied from its source repository at the commit pinned in
// SOURCES. The text is not edited beyond the passages in REWORDED. A file may be split into one page per top-level heading, and
// links and images are rewritten: to the page that holds the target when it is imported too, and
// to GitHub at the pinned commit otherwise. Outside code, `<` and `{` are escaped, since vocs
// compiles every page as MDX and would read them as JSX. To update the docs, change the source
// file, move the pin and run `yarn docs:import-midnight`.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCES = {
  'midnight-integration': {
    repo: 'sig-net/midnight-integration',
    commit: 'c9ab0d638532cbb14ff3c330d60a25bb3c8a1c53',
  },
  'midnight-examples': {
    repo: 'sig-net/midnight-examples',
    commit: 'acbdf742f075cdcb2b80ae9ab35e8b9cc0103fc3',
  },
}

/**
 * Each entry: the source, the file in it, and the docs route the file becomes. A file with an
 * object in place of the route is split at its top-level headings, each heading's section
 * becoming the route listed for it. A section routed to HOME is not imported: the home page,
 * docs/pages/index.mdx, is edited by hand, and links to that section lead there.
 */
const HOME = '/'

const PAGES = [
  [
    'midnight-integration',
    'README.md',
    {
      'Sig Network Midnight Integration': HOME,
      'Sign Bidirectional Protocol Flow': '/midnight/protocol-flow',
      'Integrator Guide': '/midnight/integrator-guide',
      'Contributor Guide': '/midnight/contributor-guide',
      Prerequisites: '/midnight/prerequisites',
      Packages: '/midnight/packages',
    },
  ],
  [
    'midnight-integration',
    'packages/signet-midnight/README.md',
    '/midnight/packages/midnight',
  ],
  [
    'midnight-integration',
    'packages/signet-signer/README.md',
    '/midnight/packages/midnight-signer',
  ],
  [
    'midnight-integration',
    'packages/signet-responder/README.md',
    '/midnight/packages/midnight-responder',
  ],
  [
    'midnight-integration',
    'packages/signet-contract-deploy/README.md',
    '/midnight/packages/midnight-contract-deploy',
  ],
  [
    'midnight-integration',
    'packages/midnight-serde-ts/README.md',
    '/midnight/packages/midnight-serde',
  ],
  [
    'midnight-integration',
    'packages/midnight-serde-rs/README.md',
    '/midnight/packages/signet-midnight-serde',
  ],
  ['midnight-examples', 'README.md', '/midnight/examples'],
  [
    'midnight-examples',
    'examples/erc20-vault/README.md',
    '/midnight/erc20-vault',
  ],
  [
    'midnight-examples',
    'examples/erc20-vault/docs/deposit/deposit.md',
    '/midnight/erc20-vault/deposit',
  ],
  [
    'midnight-examples',
    'examples/erc20-vault/docs/withdraw/withdraw.md',
    '/midnight/erc20-vault/withdraw',
  ],
  [
    'midnight-examples',
    'examples/erc20-vault/docs/swap/swap.md',
    '/midnight/erc20-vault/swap',
  ],
  [
    'midnight-examples',
    'examples/erc20-vault/docs/supply/supply.md',
    '/midnight/erc20-vault/supply',
  ],
  [
    'midnight-examples',
    'examples/erc20-vault/docs/redeem/redeem.md',
    '/midnight/erc20-vault/redeem',
  ],
  [
    'midnight-examples',
    'examples/erc20-vault/docs/contention-handling.md',
    '/midnight/erc20-vault/contention-handling',
  ],
]

/**
 * Passages reworded in an imported file, each as the source text and what replaces it. A README
 * speaks of "this repository", which reads wrongly on a docs page, and the package README's
 * under construction notice is left out. Each source text must still be in its file, so a stale
 * entry fails the import.
 */
const REWORDED = {
  'midnight-integration:README.md': [
    [
      'The two caller contracts in this repository are worked examples of each case:',
      'The two caller contracts in the `sig-net/midnight-integration` repository are worked examples of each case:',
    ],
    [
      "On a local stack there is no fixed value: this repository's [integration-test setup](packages/integration-tests) generates a fresh `MPC_ROOT_KEY`, prints it during setup and appends it to the repo-root `.env`",
      'On a local stack there is no fixed value: the `sig-net/midnight-integration` [integration-test setup](packages/integration-tests) generates a fresh `MPC_ROOT_KEY`, prints it during setup and appends it to the `.env` at the root of that repository',
    ],
  ],
  'midnight-integration:packages/signet-midnight/README.md': [
    [
      `> ## 🚧 Under Construction 🚧
>
> This Sig Network Midnight integration is still under construction.
> Use at your own risk and expect rapid iteration.

`,
      '',
    ],
  ],
  'midnight-examples:README.md': [
    [
      'This monorepo holds experimental example contracts for Midnight.',
      'The [`sig-net/midnight-examples`](https://github.com/sig-net/midnight-examples) repository holds experimental example contracts for Midnight.',
    ],
    [
      "This repository's compile scripts already pass it.",
      'The `sig-net/midnight-examples` compile scripts already pass it.',
    ],
  ],
  'midnight-examples:examples/erc20-vault/README.md': [
    [
      'Everything runs from the repo root against the local docker stack',
      'Everything runs from the root of the `sig-net/midnight-examples` repository against the local docker stack',
    ],
  ],
}

const IMAGE = /\.(png|jpe?g|gif|svg|webp)$/i
const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')

/** The lines of `text`, each with whether it sits inside a fenced code block. */
function linesOf(text) {
  let fence = null
  return text.split('\n').map((line) => {
    const marker = /^\s*(```+|~~~+)/.exec(line)?.[1]
    if (marker === undefined) return { line, code: fence !== null }
    if (fence === null) fence = marker[0]
    else if (marker[0] === fence) fence = null
    return { line, code: true }
  })
}

/** A heading's anchor, as GitHub and vocs both derive it. */
function anchorOf(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-')
}

/** The pages a source file becomes: one, or one per top-level heading when it is split. */
function partsOf(text, routes) {
  if (typeof routes === 'string') return [{ route: routes, text }]
  const parts = []
  for (const { line, code } of linesOf(text)) {
    const title = code ? undefined : /^# (.+)$/.exec(line)?.[1].trim()
    if (title !== undefined) {
      const route = routes[title]
      if (route === undefined)
        throw new Error(`No route for the section "${title}"`)
      parts.push({ route, lines: [] })
    }
    if (parts.length === 0)
      throw new Error('A split file must open with a top-level heading')
    parts.at(-1).lines.push(line)
  }
  return parts.map(({ route, lines }) => ({
    route,
    text: lines.join('\n').trimEnd() + '\n',
  }))
}

/** Fetched once per file: its parts, and which part holds each heading's anchor. */
const imported = new Map()
for (const [source, file, routes] of PAGES) {
  const { repo, commit } = SOURCES[source]
  const response = await fetch(
    `https://raw.githubusercontent.com/${repo}/${commit}/${file}`
  )
  if (!response.ok)
    throw new Error(`${repo} ${file}: HTTP ${String(response.status)}`)
  let sourceText = await response.text()
  for (const [from, to] of REWORDED[`${source}:${file}`] ?? []) {
    if (!sourceText.includes(from)) {
      throw new Error(`${repo} ${file} no longer holds "${from.slice(0, 40)}"`)
    }
    sourceText = sourceText.replace(from, to)
  }
  const parts = partsOf(sourceText, routes)
  const anchors = new Map()
  for (const { route, text } of parts) {
    for (const { line, code } of linesOf(text)) {
      const heading = code ? undefined : /^#{1,6} (.+)$/.exec(line)?.[1]
      if (heading !== undefined && !anchors.has(anchorOf(heading)))
        anchors.set(anchorOf(heading), route)
    }
  }
  imported.set(`${source}:${file}`, { parts, anchors })
}

/** The docs route of a link into a source file, when that file is imported. */
function routeOf(source, path, anchor) {
  const file = [path, posix.join(path, 'README.md')].find((p) =>
    imported.has(`${source}:${p}`)
  )
  if (file === undefined) return undefined
  const { parts, anchors } = imported.get(`${source}:${file}`)
  const route = anchors.get(anchor.slice(1)) ?? parts[0].route
  // A link to a section that opens its own page needs no anchor.
  const opensPage = parts.some(
    (part) =>
      part.route === route &&
      anchorOf(/^# (.+)$/m.exec(part.text)?.[1] ?? '') === anchor.slice(1)
  )
  return route + (opensPage ? '' : anchor)
}

/** Where a link in `file` points once the file lives in the docs. */
function rewriteTarget(source, file, target) {
  const github =
    /^https:\/\/github\.com\/(sig-net\/[^/]+)\/blob\/[^/]+\/([^#]+)(#.*)?$/.exec(
      target
    )
  if (github !== null) {
    const other = Object.keys(SOURCES).find(
      (key) => SOURCES[key].repo === github[1]
    )
    return (other && routeOf(other, github[2], github[3] ?? '')) ?? target
  }
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return target
  const [, path, anchor = ''] = /^([^#]*)(#.*)?$/.exec(target)
  const resolved =
    path === ''
      ? file
      : posix
          .normalize(posix.join(posix.dirname(file), path))
          .replace(/\/$/, '')
  const route = routeOf(source, resolved, anchor)
  if (route !== undefined) return route
  if (path === '') return target
  const { repo, commit } = SOURCES[source]
  if (IMAGE.test(resolved))
    return `https://raw.githubusercontent.com/${repo}/${commit}/${resolved}`
  const kind = posix.basename(resolved).includes('.') ? 'blob' : 'tree'
  return `https://github.com/${repo}/${kind}/${commit}/${resolved}${anchor}`
}

/** Markdown that MDX reads as the same text: autolinks spelt out, `<` and `{` escaped outside code spans. */
function escapeForMdx(line) {
  return line
    .split(/(`+[^`]*`+)/)
    .map((piece) =>
      piece.startsWith('`')
        ? piece
        : piece
            .replace(/<(https?:\/\/[^>\s]+)>/g, '[$1]($1)')
            .replace(/(?<!\\)([<{])/g, '\\$1')
    )
    .join('')
}

/** Rewrites inline and reference-style link targets and escapes for MDX, leaving fenced code untouched. */
function convert(source, file, text) {
  return linesOf(text)
    .map(({ line, code }) =>
      code
        ? line
        : escapeForMdx(line)
            .replace(
              /(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g,
              (_, open, target, close) =>
                open + rewriteTarget(source, file, target) + close
            )
            .replace(
              /^(\s*\[[^\]]+\]:\s+)(\S+)/,
              (_, label, target) => label + rewriteTarget(source, file, target)
            )
    )
    .join('\n')
}

for (const [source, file] of PAGES) {
  const { repo, commit } = SOURCES[source]
  for (const { route, text } of imported.get(`${source}:${file}`).parts) {
    if (route === HOME) continue
    const origin = `{/* Imported from ${repo} ${file} at ${commit} by docs/scripts/import-midnight-docs.mjs. Edit it there. */}\n\n`
    const target = join(pagesDir, `${route.slice(1)}.mdx`)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, origin + convert(source, file, text))
    console.log(`${route} <- ${repo} ${file}`)
  }
}

// ---- TypeScript reference -----------------------------------------------------------------------

/**
 * The reference page of `@sig-net/midnight`: every export of its entry point, with the declaration
 * and the TSDoc comment written beside it in the source.
 */
const REFERENCE = {
  source: 'midnight-integration',
  entry: 'packages/signet-midnight/src/index.ts',
  route: '/midnight/typescript-reference',
}

const ts = (await import('typescript')).default

async function parseSource(source, file) {
  const { repo, commit } = SOURCES[source]
  const response = await fetch(
    `https://raw.githubusercontent.com/${repo}/${commit}/${file}`
  )
  if (!response.ok) {
    throw new Error(`${repo} ${file}: HTTP ${String(response.status)}`)
  }
  return ts.createSourceFile(
    file,
    await response.text(),
    ts.ScriptTarget.Latest,
    true
  )
}

/** A TSDoc comment as Markdown: its description, then its tags as a list. */
function docOf(node) {
  const doc = node.jsDoc?.at(-1)
  if (doc === undefined) return ''
  const prose = (text) =>
    (ts.getTextOfJSDocComment(text) ?? '')
      .replace(/\{@link\s+([^}\s|]+)[^}]*\}/g, '`$1`')
      .split('\n')
      .map(escapeForMdx)
      .join('\n')
  const tags = (doc.tags ?? []).map((tag) => {
    const name = tag.name === undefined ? '' : ` \`${tag.name.getText()}\``
    const text = prose(tag.comment)
      .replace(/^\s*-\s*/, '')
      .replace(/\n\s*/g, ' ')
    return `- **${tag.tagName.text}**${name}${text === '' ? '' : `: ${text}`}`
  })
  return [prose(doc.comment), tags.join('\n')].filter(Boolean).join('\n\n')
}

const has = (node, kind) =>
  node.modifiers?.some((m) => m.kind === kind) ?? false

/** A declaration without its implementation: a function or method up to its body. */
function signatureOf(node, sourceFile) {
  const end =
    node.body === undefined ? node.end : node.body.getStart(sourceFile)
  return sourceFile.text
    .slice(node.getStart(sourceFile), end)
    .replace(/^export\s+/, '')
    .trim()
}

/** The Markdown of one exported declaration, or of each variable a statement declares. */
function entriesOf(statement, sourceFile) {
  const entry = (name, node, code) => {
    const doc = docOf(node)
    return [
      name,
      `### \`${name}\`\n\n${doc === '' ? '' : `${doc}\n\n`}\`\`\`ts\n${code}\n\`\`\`\n`,
    ]
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) => {
      const lines = signatureOf(statement, sourceFile).split('\n')
      const code =
        lines.length > 12
          ? [...lines.slice(0, 12), '// ...'].join('\n')
          : lines.join('\n')
      return entry(declaration.name.getText(sourceFile), statement, code)
    })
  }
  if (ts.isClassDeclaration(statement)) {
    const members = statement.members
      .filter(
        (member) =>
          (ts.isMethodDeclaration(member) ||
            ts.isConstructorDeclaration(member)) &&
          !has(member, ts.SyntaxKind.PrivateKeyword) &&
          !has(member, ts.SyntaxKind.ProtectedKeyword) &&
          !(member.name !== undefined && ts.isPrivateIdentifier(member.name))
      )
      .map((member) => {
        const doc = docOf(member)
        const name = ts.isConstructorDeclaration(member)
          ? 'constructor'
          : member.name.getText(sourceFile)
        return `#### \`${statement.name.text}.${name}\`\n\n${doc === '' ? '' : `${doc}\n\n`}\`\`\`ts\n${signatureOf(member, sourceFile)}\n\`\`\`\n`
      })
    const [name, text] = entry(
      statement.name.text,
      statement,
      `class ${statement.name.text}`
    )
    return [[name, [text, ...members].join('\n')]]
  }
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return [
      entry(statement.name.text, statement, signatureOf(statement, sourceFile)),
    ]
  }
  return []
}

const entryFile = await parseSource(REFERENCE.source, REFERENCE.entry)
const sections = []
for (const statement of entryFile.statements) {
  if (
    !ts.isExportDeclaration(statement) ||
    statement.moduleSpecifier === undefined
  )
    continue
  const specifier = statement.moduleSpecifier.text
  // The compiled contract module is generated at build time and is not in the repository.
  if (!specifier.endsWith('.ts')) continue
  const file = posix.join(posix.dirname(REFERENCE.entry), specifier)
  const moduleFile = await parseSource(REFERENCE.source, file)
  const wanted =
    statement.exportClause === undefined
      ? undefined
      : new Set(
          statement.exportClause.elements.map(
            (e) => (e.propertyName ?? e.name).text
          )
        )
  const entries = moduleFile.statements
    .filter((s) => has(s, ts.SyntaxKind.ExportKeyword))
    .flatMap((s) => entriesOf(s, moduleFile))
    .filter(([name]) => wanted === undefined || wanted.has(name))
  if (entries.length === 0) continue
  sections.push(
    `## \`${posix.basename(file)}\`\n\n${entries.map(([, text]) => text).join('\n')}`
  )
}

{
  const { repo, commit } = SOURCES[REFERENCE.source]
  const origin = `{/* Generated from ${repo} ${posix.dirname(REFERENCE.entry)} at ${commit} by docs/scripts/import-midnight-docs.mjs. Edit the TSDoc comments there. */}\n\n`
  const target = join(pagesDir, `${REFERENCE.route.slice(1)}.mdx`)
  await writeFile(
    target,
    `${origin}# TypeScript Reference\n\nEvery export of \`@sig-net/midnight\`, with the declaration and the comment written beside it in the source.\n\n${sections.join('\n')}`
  )
  console.log(`${REFERENCE.route} <- ${repo} ${REFERENCE.entry}`)
}
