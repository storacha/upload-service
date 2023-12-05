import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

export default function QuestionIcon({ title }: { title: string }) {
  return (
    <QuestionMarkCircleIcon
      className='w-9 inline-block align-middle mb-1 px-2 py-0 cursor-pointer hover:text-white'
      title={title}
    />
  )
}