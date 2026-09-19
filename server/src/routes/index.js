import { Router } from 'express'

import { healthRouter } from './health.js'
import { fiscalYearsRouter } from './fiscal-years.js'
import { departmentsRouter } from './departments.js'
import { itemCategoriesRouter } from './item-categories.js'
import { requestStatusesRouter } from './request-statuses.js'
import { usersRouter } from './users.js'
import { purchaseRequestsRouter } from './purchase-requests.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/fiscal-years', fiscalYearsRouter)
apiRouter.use('/departments', departmentsRouter)
apiRouter.use('/item-categories', itemCategoriesRouter)
apiRouter.use('/request-statuses', requestStatusesRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/purchase-requests', purchaseRequestsRouter)
