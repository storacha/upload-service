import chalk from 'chalk'

/**
 * @param {string} label
 * @param {string} value
 */
export function line(label, value) {
  return `${chalk.dim(label.padEnd(16))} ${value}`
}

/**
 * @param {string} label
 * @param {string} value
 * @param {number} labelWidth
 */
export function formatKeyValueLine(label, value, labelWidth) {
  return `${chalk.dim(label.padEnd(labelWidth))} ${value}`
}

/**
 * @param {string} title
 * @param {string[]} lines
 * @param {(text: string) => string} color
 */
export function renderBox(title, lines, color) {
  const width = Math.max(
    title.length,
    ...lines.map((entry) => stripAnsi(entry).length)
  )
  const top = `┌─ ${title} ${'─'.repeat(Math.max(width - title.length - 1, 0))}┐`
  const body = lines.map(
    (entry) => `│ ${entry}${' '.repeat(width - stripAnsi(entry).length)} │`
  )
  const bottom = `└${'─'.repeat(width + 2)}┘`
  return color([top, ...body, bottom].join('\n'))
}

/**
 * @param {string} title
 * @param {string[]} lines
 * @param {(text: string) => string} color
 */
export function renderNotice(title, lines, color) {
  return renderBox(title, lines, color)
}

/**
 * @param {string} title
 * @param {string[]} lines
 */
export function renderWarningSection(title, lines) {
  const header = chalk.yellow(`┌─ ${title} ${'─'.repeat(16)}`)
  const body = lines.map((line) => chalk.yellow(`  • ${line}`))
  return [header, ...body].join('\n')
}

/**
 * @param {string} value
 */
function stripAnsi(value) {
  const escape = String.fromCharCode(27)
  return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, 'g'), '')
}
