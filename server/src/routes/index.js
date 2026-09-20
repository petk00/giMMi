import { Router } from 'express'

import { healthRouter } from './health.js'
import { fiscalYearsRouter } from './fiscal-years.js'
import { departmentBudgetsRouter } from './department-budgets.js'
import { itemCategoryBudgetsRouter } from './item-category-budgets.js'
import { purchaseRequestStatusesRouter } from './purchase-request-statuses.js'
import { documentTypesRouter } from './document-types.js'
import { usersRouter } from './users.js'
import { purchaseRequestsRouter } from './purchase-requests.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/fiscal-years', fiscalYearsRouter)
apiRouter.use('/department-budgets', departmentBudgetsRouter)
apiRouter.use('/item-category-budgets', itemCategoryBudgetsRouter)
apiRouter.use('/purchase-request-statuses', purchaseRequestStatusesRouter)
apiRouter.use('/document-types', documentTypesRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/purchase-requests', purchaseRequestsRouter)
