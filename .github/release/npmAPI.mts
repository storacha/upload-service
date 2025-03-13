import npmFetch from 'npm-registry-fetch'

export async function isVersionPublished(packageName: string, version: string) {
  try {
    await npmFetch(`/${packageName}/${version}`)
    // If the request is successful, the version has already been published.
    return true
  } catch (e) {
    if (isNpmNotFoundError(e)) {
      // If the request fails with a 404, the version has not been published yet.
      return false
    } else {
      // If the request fails with another error, rethrow it.
      throw e
    }
  }
}

function isNpmNotFoundError(e: unknown) {
  return (
    e &&
    typeof e === 'object' &&
    'name' in e &&
    e.name === 'HttpErrorGeneral' &&
    'statusCode' in e &&
    e.statusCode === 404
  )
}
