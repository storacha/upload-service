import { Result } from '@ucanto/interface'
import { toast } from 'react-hot-toast'

export const ucantoast = async (promise: Promise<Result>, options: any = {}) => {
  return toast.promise((async () => {
    const result = await promise
    if (result.ok) {
      return result.ok
    } else {
      throw result.error
    }
  })(), options)
}
