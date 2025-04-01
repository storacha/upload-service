export const REFERRALS_SERVICE = process.env.NEXT_PUBLIC_REFERRALS_SERVICE_URL

export async function createRefcode (form: FormData) {
  return fetch(`${REFERRALS_SERVICE}/refcode/create`, {
    method: 'POST',
    body: form
  })
}

export async function createReferral (form: FormData) {
  return fetch(`${REFERRALS_SERVICE}/referrals/create`, {
    method: 'POST',
    body: form
  })
}