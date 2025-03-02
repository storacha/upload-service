import path from 'node:path'
import fs from 'node:fs'
import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release'
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

const octokit = new Octokit({ auth: requiredEnvVar('GITHUB_TOKEN') })
const git = simpleGit()

log.setDefaultLevel('info')

if (process.env.LOGLEVEL !== '') {
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

const pendingVersions = Object.entries(versionResult.projectsVersionData)
  .filter(([, versionData]) => versionData.newVersion)
  .map(([project, versionData]) => `${project}@${versionData.newVersion}`)

if (pendingVersions.length > 0) {
  const pendingVersionsString = pendingVersions.join(', ')

  log.info(
    `There are pending versions. Let's create a release PR for ${pendingVersionsString}.`
  )

  log.debug('Setting git user info.')
  await git.addConfig('user.email', 'rachabot@storacha.network')
  await git.addConfig('user.name', 'Rachabot')

  log.debug(`Checking out ${RELEASE_BRANCH}.`)
  await git.checkoutLocalBranch(RELEASE_BRANCH)

  log.info('Updating changelogs from version plans.')
  const changelogResult = await releaseChangelog({
    versionData: versionResult.projectsVersionData,
    deleteVersionPlans: true,
    createRelease: false,
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

  const prTitle = `Release ${pendingVersionsString}`

  log.debug('Release PR:', {
    title: prTitle,
    body: prBody,
  })

  log.info('Creating/updating release PR.')
  await createOrUpdateReleasePR({
    octokit,
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
      git.addAnnotatedTag(tagName, changelogEntry)

      log.debug('Release:', {
        tagName,
        body: changelogEntry,
        prerelease: currentVersion.includes('-'),
      })

      log.info(`Creating/updating ${tagName} release on GitHub.`)
      createOrUpdateRelease({
        octokit,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        tagName,
        body: changelogEntry,
        prerelease: currentVersion.includes('-'),
      })
    }
  }

  log.info('Pushing tags to origin.')
  git.pushTags('origin')

  log.info('Publishing packages.')
  const publishResult = await releasePublish({})
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
