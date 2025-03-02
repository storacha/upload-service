import { RequestError, type Octokit } from 'octokit'

type ExistingPullRequestQueryData = {
  repository?: {
    id: string
    pullRequests: {
      nodes: {
        id: string
      }[]
    }
  }
}

export const createOrUpdateReleasePR = async ({
  octokit,
  owner,
  repo,
  releaseBranchName,
  mainBranchName,
  title,
  body,
}: {
  octokit: Octokit
  owner: string
  repo: string
  releaseBranchName: string
  mainBranchName: string
  title: string
  body: string
}) => {
  // TK logging
  console.log('Checking for an existing pull request')

  // GraphQL because the REST API can't correctly find a pull request by head
  // and base. It appears to do a substring match rather than an exact match.
  const queryResponse = await octokit.graphql<ExistingPullRequestQueryData>(
    /* graphql */ `
    query ExistingPullRequestQuery(
      $owner: String!
      $name: String!
      $headRefName: String!
      $baseRefName: String!
    ) {
      repository(owner: $owner, name: $name) {
        id
        pullRequests(
          baseRefName: $baseRefName
          headRefName: $headRefName
          states: OPEN
          first: 1
        ) {
          nodes {
            id
          }
        }
      }
    }
  `,
    {
      owner,
      name: repo,
      headRefName: releaseBranchName,
      baseRefName: mainBranchName,
    }
  )

  if (!queryResponse.repository) {
    throw new Error(`Repository ${owner}/${repo} not found!`)
  }

  if (queryResponse.repository.pullRequests.nodes.length == 0) {
    console.log('Creating a new pull request')
    await octokit.graphql(
      /* graphql */ `
      mutation CreatePullRequestMutation(
        $repositoryId: ID!
        $baseRefName: String!
        $headRefName: String!
        $title: String!
        $body: String!
      ) {
        createPullRequest(
          input: {
            repositoryId: $repositoryId
            baseRefName: $baseRefName
            headRefName: $headRefName
            title: $title
            body: $body
          }
        ) {
          __typename
        }
      }
    `,
      {
        repositoryId: queryResponse.repository.id,
        baseRefName: mainBranchName,
        headRefName: releaseBranchName,
        title,
        body,
      }
    )
  } else {
    console.log('Updating the existing pull request')
    await octokit.graphql(
      /* graphql */ `
      mutation UpdatePullRequestMutation(
        $pullRequestId: ID!
        $title: String!
        $body: String!
      ) {
        updatePullRequest(
          input: {
            pullRequestId: $pullRequestId
            title: $title,
            body: $body
          }
        ) {
          __typename
        }
      }
    `,
      {
        pullRequestId: queryResponse.repository.pullRequests.nodes[0].id,
        title,
        body,
      }
    )
  }
}

export const createOrUpdateRelease = async ({
  octokit,
  owner,
  repo,
  tagName,
  body,
  prerelease,
}: {
  octokit: Octokit
  owner: string
  repo: string
  tagName: string
  body: string
  prerelease: boolean
}) => {
  // REST API because the GraphQL API doesn't support releases.
  try {
    const {
      data: { id: existingReleaseId },
    } = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: tagName,
    })

    console.log('Updating the existing release')
    await octokit.rest.repos.updateRelease({
      owner,
      repo,
      release_id: existingReleaseId,
      name: tagName,
      tag_name: tagName,
      body,
      prerelease,
    })
  } catch (e) {
    if (isGitHubNotFoundError(e)) {
      console.log('Creating a new release')
      await octokit.rest.repos.createRelease({
        owner,
        repo,
        name: tagName,
        tag_name: tagName,
        body,
        prerelease,
      })
    } else {
      console.error(e)
    }
  }
}

function isGitHubNotFoundError(e: unknown) {
  return e instanceof RequestError && e.status === 404
}
