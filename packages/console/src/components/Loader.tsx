interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'spinner' | 'dots' | 'pulse'
  message?: string
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
}

function SpinnerLoader({ size = 'md', className = '' }: { size?: keyof typeof sizeClasses, className?: string }) {
  return (
    <div 
      className={`${sizeClasses[size]} ${className}`}
      style={{
        animation: 'spin 1s cubic-bezier(0.4, 0.0, 0.2, 1) infinite'
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="60"
          strokeDashoffset="60"
          className="opacity-20"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="15"
          strokeDashoffset="15"
          className="opacity-100"
          style={{
            animation: 'spin-dash 1.5s ease-in-out infinite'
          }}
        />
      </svg>
    </div>
  )
}

function DotsLoader({ size = 'md', className = '' }: { size?: keyof typeof sizeClasses, className?: string }) {
  const dotSize = size === 'sm' ? 'w-1 h-1' : size === 'lg' ? 'w-2 h-2' : size === 'xl' ? 'w-3 h-3' : 'w-1.5 h-1.5'
  
  return (
    <div className={`flex space-x-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${dotSize} bg-current rounded-full`}
          style={{
            animation: `pulse-dot 1.4s ease-in-out infinite both`,
            animationDelay: `${i * 0.16}s`
          }}
        />
      ))}
    </div>
  )
}

function PulseLoader({ size = 'md', className = '' }: { size?: keyof typeof sizeClasses, className?: string }) {
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-current ${className}`}
      style={{
        animation: 'pulse-scale 2s cubic-bezier(0.4, 0.0, 0.6, 1) infinite'
      }}
    />
  )
}

export default function Loader({ 
  size = 'md', 
  variant = 'spinner', 
  message,
  className = '' 
}: LoaderProps) {
  const LoaderComponent = variant === 'dots' ? DotsLoader : variant === 'pulse' ? PulseLoader : SpinnerLoader
  
  return (
    <div className={`flex items-center gap-2 text-hot-red ${className}`}>
      <LoaderComponent size={size} />
      {message && <span className="text-sm text-gray-600 font-medium">{message}</span>}
    </div>
  )
}

// Legacy compatibility
export function DefaultLoader({ className = '' }: { className?: string }) {
  return <Loader className={className} />
}

export const TopLevelLoader = ({ message }: { message?: string } = {}) => (
  <div className='min-h-screen bg-professional-branded flex flex-col items-center justify-center p-4'>
    <div className='text-center'>
      <Loader size='xl' message={message} className='mb-4 justify-center' />
      {!message && <p className="text-gray-600 text-sm">Loading...</p>}
    </div>
  </div>
)

// Context-specific loaders
export const ButtonLoader = ({ size = 'sm' }: { size?: 'sm' | 'md' }) => (
  <Loader size={size} variant='spinner' className='text-current' />
)

export const InlineLoader = ({ message }: { message?: string }) => (
  <Loader size='sm' message={message} className='inline-flex' />
)

export const CardLoader = ({ message }: { message?: string }) => (
  <div className='flex justify-center items-center py-8'>
    <Loader size='lg' message={message} />
  </div>
)
