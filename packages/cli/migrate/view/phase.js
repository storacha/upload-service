import chalk from 'chalk'

/**
 * @param {string} title
 */
export function printPhaseTitle(title) {
  const line = '━'.repeat(60)

  console.log('\n')
  console.log(chalk.cyan('┃ ') + chalk.bold(title.toUpperCase()))
  console.log(chalk.cyan(`┗${line}`))
  console.log('')
}
