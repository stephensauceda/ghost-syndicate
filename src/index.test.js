import { vi, beforeEach, afterEach, expect } from 'vitest'
import { webhooks } from './index.js'
import { syndicate } from './lib/syndicate/index.js'
import { validateWebhook } from './lib/validateWebhook.js'
import { send as sendWebmentions } from './lib/webmentions/index.js'

beforeEach(() => {
  vi.mock('./lib/validateWebhook', () => ({
    validateWebhook: vi.fn(),
  }))

  vi.mock('./lib/syndicate', () => ({
    syndicate: vi.fn().mockResolvedValue(true),
  }))

  vi.mock('./lib/webmentions', () => ({
    send: vi.fn().mockResolvedValue(true),
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('does not allow unauthorized requests', async () => {
  validateWebhook.mockReturnValue(false)
  const req = { headers: {}, body: {}, method: 'POST' }
  const res = { status: vi.fn(() => res), send: vi.fn() }

  await webhooks(req, res)
  expect(res.status).toHaveBeenCalledWith(401)
  expect(res.send).toHaveBeenCalledWith('Unauthorized')
})

test.each(['GET', 'DELETE', 'PUT', 'PATCH'])(
  'does not allow %s requests',
  async method => {
    validateWebhook.mockReturnValue(true)
    vi.spyOn(console, 'error')

    const req = { method, body: {} }
    const res = { status: vi.fn(() => res), send: vi.fn() }

    await webhooks(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.send).toHaveBeenCalledWith('Method not allowed')
  }
)

test('returns 200 for unknown paths', async () => {
  validateWebhook.mockReturnValue(true)
  const req = { method: 'POST', body: {}, path: '/foo' }
  const res = { status: vi.fn(() => res), send: vi.fn() }

  await webhooks(req, res)
  expect(res.status).toHaveBeenCalledWith(200)
  expect(res.send).toHaveBeenCalledWith('OK')
  expect(syndicate).not.toHaveBeenCalled()
})

describe('/syndicate', () => {
  test('syndicates a post', async () => {
    validateWebhook.mockReturnValue(true)
    const req = {
      method: 'POST',
      body: { post: { title: 'foo' } },
      path: '/syndicate',
    }
    const res = {
      status: vi.fn(() => res),
      send: vi.fn(),
    }

    await webhooks(req, res)
    expect(syndicate).toHaveBeenCalledWith(req.body.post)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith('OK')
  })

  test('catches errors for syndication', async () => {
    validateWebhook.mockReturnValue(true)
    syndicate.mockRejectedValue('rejected')
    const req = {
      method: 'POST',
      body: { post: { title: 'foo' } },
      path: '/syndicate',
    }
    const res = {
      status: vi.fn(() => res),
      send: vi.fn(),
    }

    const error = vi.spyOn(console, 'error').mockReturnThis()

    await webhooks(req, res)
    await expect(syndicate).rejects.toEqual('rejected')
    expect(syndicate).toHaveBeenCalledWith(req.body.post)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith('OK')
    expect(error).toHaveBeenCalledWith('rejected')
  })
})

describe('/send-webmentions', () => {
  test('sends webmentions', async () => {
    validateWebhook.mockReturnValue(true)
    const req = {
      method: 'POST',
      body: { post: { title: 'foo' } },
      path: '/send-webmentions',
    }
    const res = {
      status: vi.fn(() => res),
      send: vi.fn(),
    }

    await webhooks(req, res)
    expect(sendWebmentions).toHaveBeenCalledWith(req.body.post)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith('OK')
    expect(syndicate).not.toHaveBeenCalled()
  })

  test('catches errors for sending webhooks', async () => {
    validateWebhook.mockReturnValue(true)
    sendWebmentions.mockRejectedValue('rejected')
    const req = {
      method: 'POST',
      body: { post: { title: 'foo' } },
      path: '/send-webmentions',
    }
    const res = {
      status: vi.fn(() => res),
      send: vi.fn(),
    }

    const error = vi.spyOn(console, 'error').mockReturnThis()

    await webhooks(req, res)
    expect(sendWebmentions).toHaveBeenCalledWith(req.body.post)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith('OK')
    expect(error).toHaveBeenCalledWith('rejected')
  })
})
