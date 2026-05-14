import chalk from 'chalk'
import { truncateValue } from './format.js'
import { line, renderNotice } from './layout.js'

/**
 * @param {string} root
 * @param {string} shard
 * @param {string} reason
 */
export function printReaderShardFailed(root, shard, reason) {
  console.warn(
    renderNotice(
      'Shard skipped',
      [
        line('Root', truncateValue(root)),
        line('Shard', truncateValue(shard)),
        line('Reason', reason),
      ],
      chalk.yellow
    )
  )
}
