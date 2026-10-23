import { Request, Response, NextFunction, RequestHandler } from 'express'
import { Chaite, FrontEndAuthHandler } from '../index'

export const authenticateToken: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.header('Authorization')?.replace('Bearer ', '')
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined
  const token = authHeader || queryToken

  if (!token) {
    res.status(401).json({ message: 'Access denied, token missing' })
    return
  }

  try {
    const authKey = Chaite.getInstance().getGlobalConfig()?.getAuthKey()
    // 支持标准 JWT 校验或管理员静态 Secret 校验
    if (FrontEndAuthHandler.validateJWT(authKey as string, token) || (authKey && token === authKey)) {
      next()
      return
    }
    res.status(401).json({ message: 'Invalid token' })
  } catch (error) {
    res.status(401).json({ message: 'Invalid token format' })
  }
}