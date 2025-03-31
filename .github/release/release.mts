import path from 'node:path'
import fs from 'node:fs'
import {
  releaseVersion,
  releaseChangelog,
  releasePublish,
} from 'nx/release/index.js'
import { createProjectGraphAsync } from '@nx/devkit'
import { parseChangelogMarkdown } from 'nx/src/command-line/release/utils/markdown.js'
import { simpleGit } from 'simple-git'
import { Octokit } from 'octokit'
import log from 'loglevel'

import { requiredEnvVar } from './utils.mjs'
import { createOrUpdateRelease, createOrUpdateReleasePR } from './githubAPI.mjs'
import { isVersionPublished } from './npmAPI.mjs'

/** The owner (org or username) of the GitHub repo. */
const REPO_OWNER = requiredEnvVar('GITHUB_REPOSITORY_OWNER')

/** The name of the GitHub repo. */
const REPO_NAME = requiredEnvVar('GITHUB_REPOSITORY_NAME')

/** The name of the branch to PR release branches to. */
const MAIN_BRANCH = requiredEnvVar('MAIN_BRANCH_NAME')

/** The name of the release branch (which needn't yet exist). */
const RELEASE_BRANCH = requiredEnvVar('RELEASE_BRANCH_NAME')

/**
 * If DRY_RUN env var is the string "true", no tags will be created, no github
 * releases will be published and no packages will be published.
 */
const DRY_RUN = process.env.DRY_RUN === 'true'

const octokit = new Octokit({ auth: requiredEnvVar('GITHUB_TOKEN') })
const git = simpleGit()

log.setDefaultLevel('info')

log.debug('Setting git user info.')
await git.addConfig('user.email', 'rachabot@storacha.network')
await git.addConfig('user.name', 'Rachabot')

if (process.env.LOGLEVEL) {
  // Assume LOGLEVEL is a valid log level. If it's not, we'll get a useful
  // error from loglevel.
  log.setLevel(process.env.LOGLEVEL as log.LogLevelDesc)
}

if (log.getLevel() <= log.levels.DEBUG) {
  // If we're being verbose, tell Nx to be verbose too.
  process.env.NX_VERBOSE_LOGGING = 'true'
}

log.info('Bumping versions.')
const versionResult = await releaseVersion({})
log.debug('releaseVersion result:', versionResult)

const versionsArePending = Object.entries(
  versionResult.projectsVersionData
).some(([, versionData]) => versionData.newVersion)

if (versionsArePending) {
  log.info(`There are pending versions. Let's create a release PR.`)

  log.debug(`Checking out ${RELEASE_BRANCH}.`)
  await git.checkoutLocalBranch(RELEASE_BRANCH)

  log.info('Updating changelogs from version plans.')
  const changelogResult = await releaseChangelog({
    versionData: versionResult.projectsVersionData,
    deleteVersionPlans: true,
    createRelease: false,
    gitTag: false,
    gitPush: false,
  })
  log.debug('releaseChangelog result:', changelogResult)

  log.info('Pushing release branch to origin.')
  await git.push('origin', RELEASE_BRANCH, { '--force': null })

  const prBody = Object.entries(changelogResult.projectChangelogs ?? {})
    .map(([project, changelog]) =>
      // The changelog entries are meant to go in the individual project
      // changelogs, so they don't include the project name. Add the project name,
      // and also demote `h1`s (which are used for major versions) to `h2`s so
      // everything matches in the PR body.
      changelog.contents.replace(/^##? /, `## ${project}@`)
    )
    .join('\n\n')

  const versionsToReleaseString = Object.values(
    changelogResult.projectChangelogs ?? {}
  )
    .map((changelog) => changelog.releaseVersion.gitTag)
    .join(', ')

  const prTitle = `Release ${versionsToReleaseString}`

  log.debug('Release PR:', {
    title: prTitle,
    body: prBody,
  })

  log.info('Creating/updating release PR.')
  await createOrUpdateReleasePR({
    octokit,
    log,
    owner: REPO_OWNER,
    repo: REPO_NAME,
    releaseBranchName: RELEASE_BRANCH,
    mainBranchName: MAIN_BRANCH,
    title: prTitle,
    body: prBody,
  })
} else {
  log.info("There are no pending versions. Let's publish the release.")

  // We need this to locate the CHANGELOGs.
  log.debug('Reading project graph...')
  const graph = await createProjectGraphAsync()
  log.debug('Project graph nodes:', graph.nodes)

  for (const [project, { currentVersion }] of Object.entries(
    versionResult.projectsVersionData
  )) {
    const tagName = `${project}@${currentVersion}`

    if (await isVersionPublished(project, currentVersion)) {
      log.info(`${tagName} already published to registry; skipping.`)
    } else {
      log.info(`Publishing ${tagName}.`)

      // ASSUMPTION: The CHANGELOG of each project is at `CHANGELOG.md` in its
      // project root. This can be configured differently in the Nx config, and
      // we currently don't respect that config here, so changing it would break
      // this.
      const changelogPath = path.join(
        graph.nodes[project].data.sourceRoot ?? '.',
        'CHANGELOG.md'
      )
      const changelogContents = fs.readFileSync(changelogPath).toString()
      const changelog = parseChangelogMarkdown(changelogContents)
      const changelogEntry =
        changelog.releases.find((release) => release.version === currentVersion)
          ?.body ?? ''

      log.debug('Creating tag', tagName)
      if (DRY_RUN) {
        log.warn('[This is a dry run, no tag will be created.]')
      } else {
        await git.addAnnotatedTag(tagName, changelogEntry)
      }

      log.debug('Release:', {
        tagName,
        body: changelogEntry,
        prerelease: currentVersion.includes('-'),
      })

      log.info(`Creating/updating ${tagName} release on GitHub.`)
      if (DRY_RUN) {
        log.warn('[This is a dry run, no release will be created on GitHub.]')
      } else {
        await createOrUpdateRelease({
          octokit,
          log,
          owner: REPO_OWNER,
          repo: REPO_NAME,
          tagName,
          body: changelogEntry,
          prerelease: currentVersion.includes('-'),
        })
      }
    }
  }

  log.info('Pushing tags to origin.')
  git.pushTags('origin')

  log.info('Publishing packages.')
  if (DRY_RUN) log.warn('[This is a dry run, no packages will be published.]')
  const publishResult = await releasePublish({
    dryRun: DRY_RUN,
  })
  log.debug('releasePublish result:', publishResult)

  const publishFailures = Object.entries(publishResult).flatMap(
    ([name, { code }]) => (code !== 0 ? [name] : [])
  )

  if (publishFailures.length > 0) {
    log.error(
      [
        'Some packages failed to publish:',
        ...publishFailures.map((name) => `- ${name}`),
      ].join('\n')
    )
    process.exit(1)
  }

  log.info('Packages published!')
}

// Process doesn't exit without explicit exit call.
process.exit(0)
