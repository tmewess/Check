import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import accountsRouter from "./accounts";
import ordersRouter from "./orders";
import statsRouter from "./stats";
import lolzRouter from "./lolz";
import balanceRouter from "./balance";
import usersRouter from "./users";
import sessionsRouter from "./sessions";
import newsRouter from "./news";
import adminsRouter from "./admins";
import proxiesRouter from "./proxies";
import otherProductsRouter from "./other-products";
import promoRouter from "./promo";
import faqRouter from "./faq";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(accountsRouter);
router.use(ordersRouter);
router.use(statsRouter);
router.use(lolzRouter);
router.use(balanceRouter);
router.use(usersRouter);
router.use(sessionsRouter);
router.use(newsRouter);
router.use(adminsRouter);
router.use(proxiesRouter);
router.use(otherProductsRouter);
router.use(promoRouter);
router.use(faqRouter);
router.use(notificationsRouter);

export default router;
