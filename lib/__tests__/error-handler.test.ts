import { classifyError, ErrorType, AppError, retryWithBackoff } from '../error-handler'

describe('classifyError', () => {
  it('classifies Twitter API 401 error as AUTH_ERROR', () => {
    const error = {
      code: 401,
      message: 'Unauthorized',
    }
    
    const result = classifyError(error)
    
    expect(result.type).toBe(ErrorType.AUTH_ERROR)
    expect(result.retryable).toBe(false)
  })

  it('classifies Twitter API 403 error as PERMISSION_ERROR', () => {
    const error = {
      code: 403,
      message: 'Forbidden',
    }
    
    const result = classifyError(error)
    
    expect(result.type).toBe(ErrorType.AUTH_ERROR)
    expect(result.retryable).toBe(false)
  })

  it('classifies Twitter API 429 error as RATE_LIMIT_ERROR', () => {
    const error = {
      code: 429,
      message: 'Too Many Requests',
      rateLimit: {
        limit: 300,
        remaining: 0,
        reset: Date.now() + 900000, // 15 minutes
      },
    }
    
    const result = classifyError(error)
    
    expect(result.type).toBe(ErrorType.RATE_LIMIT)
    expect(result.retryable).toBe(true)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('classifies Claude API rate limit error', () => {
    const error = {
      status: 429,
      message: 'Rate limit exceeded',
      headers: {
        'retry-after': '60',
      },
    }
    
    const result = classifyError(error)
    
    expect(result.type).toBe(ErrorType.RATE_LIMIT)
    expect(result.retryable).toBe(true)
  })

  it('classifies Supabase connection error as DATABASE_ERROR', () => {
    const error = {
      code: 'ECONNREFUSED',
      message: 'Connection refused',
    }
    
    const result = classifyError(error)
    
    expect(result.type).toBe(ErrorType.DATABASE_ERROR)
    expect(result.retryable).toBe(true)
  })

  it('classifies generic network error as NETWORK_ERROR', () => {
    const error = {
      code: 'ENOTFOUND',
      message: 'DNS lookup failed',
    }
    
    const result = classifyError(error)
    
    expect(result.type).toBe(ErrorType.NETWORK_ERROR)
    expect(result.retryable).toBe(true)
  })

  it('classifies unknown error as UNKNOWN_ERROR', () => {
    const error = {
      message: 'Something went wrong',
    }
    
    const result = classifyError(error)
    
    expect(result.type).toBe(ErrorType.UNKNOWN_ERROR)
    expect(result.retryable).toBe(false)
  })

  it('extracts retry-after header', () => {
    const error = {
      status: 429,
      headers: {
        'retry-after': '120',
      },
    }
    
    const result = classifyError(error)
    
    expect(result.retryAfter).toBe(120)
  })
})

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('retries on failure and succeeds', async () => {
    let attempts = 0
    const fn = jest.fn(async () => {
      attempts++
      if (attempts < 2) {
        throw new Error('Temporary error')
      }
      return 'success'
    })

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelay: 100,
    })

    // Fast-forward time to resolve retries
    jest.advanceTimersByTime(1000)

    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('fails after max retries', async () => {
    const fn = jest.fn(async () => {
      throw new Error('Persistent error')
    })

    const promise = retryWithBackoff(fn, {
      maxRetries: 2,
      initialDelay: 100,
    })

    jest.advanceTimersByTime(1000)

    await expect(promise).rejects.toThrow('Persistent error')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('does not retry on non-retryable errors', async () => {
    const fn = jest.fn(async () => {
      const error: any = new Error('Auth error')
      error.code = 401
      throw error
    })

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelay: 100,
      onRetry: (attempt: number, error: any) => {
        const classified = classifyError(error)
        if (!classified.retryable) {
          throw error
        }
      },
    })

    jest.advanceTimersByTime(100)

    await expect(promise).rejects.toThrow('Auth error')
    expect(fn).toHaveBeenCalledTimes(1) // no retries
  })

  it('uses exponential backoff', async () => {
    const delays: number[] = []
    const originalSetTimeout = global.setTimeout
    global.setTimeout = jest.fn((callback: any, delay: number) => {
      delays.push(delay)
      return originalSetTimeout(callback, delay)
    }) as any

    let attempts = 0
    const fn = jest.fn(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('Temporary error')
      }
      return 'success'
    })

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
    })

    jest.advanceTimersByTime(5000)

    await promise

    // First retry: 100ms, second retry: ~200ms (exponential)
    expect(delays.length).toBeGreaterThan(0)
    expect(delays[0]).toBe(100)
    if (delays.length > 1) {
      expect(delays[1]).toBeGreaterThan(delays[0])
    }

    global.setTimeout = originalSetTimeout
  })
})
