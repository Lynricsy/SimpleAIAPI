import express from 'express';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { logger } from './logger';
import { requestLogger } from './middleware/requestLogger';
import { authenticateRequest } from './middleware/auth';
import { ensureImageDirectory } from './utils/imageStore';
import { parseProxyPayload } from './services/payloadParser';
import { buildChatCompletionRequest } from './services/messageBuilder';
import { requestChatCompletion } from './services/upstreamClient';
import { renderMarkdownToHtml } from './services/renderer';
import { extractAssistantMessage } from './utils/messageExtractor';
import type { RawProxyPayload } from './types/payload';
import { scheduleImageCleanup } from './services/imageCleaner';
import { publishRenderedPage } from './services/pagePublisher';
import { ensurePagesDirectory } from './utils/pageStore';
import { getKatexStyleTag } from './utils/katexStyle';
import { ensureKatexFonts } from './utils/katexAssets';
import { buildQuestionHtml } from './services/questionRenderer';
import { ensureShareMetadataDirectory, readShareMetadata } from './utils/shareMetadataStore';
import { markImagesProtected, initProtectedImagesStore } from './utils/protectedImages';

const app = express();

const bootstrap = async (): Promise<void> => {
  await Promise.all([
    ensureImageDirectory(),
    ensurePagesDirectory(),
    ensureKatexFonts(),
    ensureShareMetadataDirectory(),
    initProtectedImagesStore(),
  ]);
  scheduleImageCleanup();

  app.use(express.json({ limit: '100mb' }));
  app.use(requestLogger);

  const staticDir = path.resolve(process.cwd(), 'public');
  app.use('/img', express.static(path.join(staticDir, 'img')));
  app.use('/pages', express.static(path.join(staticDir, 'pages')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/share/:shareId', async (req, res) => {
    try {
      const shareId = req.params.shareId;
      const metadata = await readShareMetadata(shareId);
      if (!metadata) {
        res.status(404).send('分享链接不存在');
        return;
      }
      await markImagesProtected(metadata.imageFiles);
      const stripped = metadata.htmlRelativePath.startsWith('/')
        ? metadata.htmlRelativePath.slice(1)
        : metadata.htmlRelativePath;
      const absolute = path.resolve(process.cwd(), 'public', stripped);
      res.sendFile(absolute, (error) => {
        if (error) {
          const status = (error as NodeJS.ErrnoException & { statusCode?: number }).statusCode ?? 500;
          logger.error('分享页面传输失败', { shareId, message: error.message });
          if (!res.headersSent) {
            res.status(status).send('无法获取分享页面');
          }
        }
      });
    } catch (error) {
      logger.error('分享页面读取失败', { message: (error as Error).message });
      res.status(500).send('无法获取分享页面');
    }
  });

  const handler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = (req.body ?? {}) as RawProxyPayload;
      const parsed = await parseProxyPayload(payload);
      const chatRequest = buildChatCompletionRequest(parsed, req);
      logger.info('✅ 已整理成 OpenAI 标准格式', {
        model: chatRequest.model,
        messageCount: chatRequest.messages.length,
      });

      const upstreamResponse = await requestChatCompletion(chatRequest);
      const assistant = upstreamResponse.choices?.[0]?.message?.content;
      const finalText = extractAssistantMessage(assistant);

      if (!finalText) {
        res.status(502).send('上游响应为空');
        return;
      }

      if (config.logAssistantResponses) {
        logger.info('📝 AI 原始回复', { content: finalText });
      }

      const htmlContent = renderMarkdownToHtml(finalText);

      if (parsed.renderMode === 'inline-html') {
        const payload = `${getKatexStyleTag()}${htmlContent}`;
        res.type('text/html; charset=utf-8').send(payload);
      } else if (parsed.renderMode === 'hosted-page') {
        const questionHtml = buildQuestionHtml(parsed.messages);
        const publishResult = await publishRenderedPage(
          htmlContent,
          { model: chatRequest.model, questionHtml },
          req,
        );
        res.type('text/plain; charset=utf-8').send(publishResult.previewUrl);
      } else {
        res.type('text/plain; charset=utf-8').send(finalText);
      }
    } catch (error) {
      next(error);
    }
  };

  app.post('/', authenticateRequest, handler);
  app.post('/proxy', authenticateRequest, handler);

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('服务器发生错误', { message: error.message });
    res.status(500).json({ error: error.message });
  });

  app.listen(config.port, () => {
    logger.info('🚀 中转服务启动完成', {
      port: config.port,
      upstream: config.upstreamBaseUrl,
      defaultModel: config.defaultModel,
    });
  });
};

void bootstrap();
