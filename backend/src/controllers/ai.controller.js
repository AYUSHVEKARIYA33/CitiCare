import { readFile, unlink } from 'fs/promises';
import { Department } from '../models/Department.js';
import { generateDraftHelper } from '../services/ai/draft-helper.js';
import { generateImageSuggestions } from '../services/ai/image-suggest.js';

export async function draftHelper(req, res) {
  try {
    const { title, description, category } = req.body;

    if (!title && !description) {
      res.status(400).json({ error: 'Title or description is required' });
      return;
    }

    if ((title || '').length > 200 || (description || '').length > 4000) {
      res.status(400).json({ error: 'Input exceeds allowed length' });
      return;
    }

    const result = await generateDraftHelper({
      title: (title || '').trim(),
      description: (description || '').trim(),
      category: (category || '').trim() || undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('[POST /api/ai/draft-helper]', error?.message ?? error);
    res.status(500).json({ error: 'Failed to generate draft helper suggestions' });
  }
}

export async function imageSuggest(req, res) {
  const file = req.file;

  try {
    const imageBuffer = file?.buffer || (file?.path ? await readFile(file.path) : null);
    if (!imageBuffer || !file?.mimetype) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }

    let departments = [];
    try {
      departments = await Department.find().select('_id name category').lean();
    } catch (departmentError) {
      console.warn('[POST /api/ai/image-suggest] Department lookup failed; continuing without department matches:', departmentError?.message ?? departmentError);
    }

    const result = await generateImageSuggestions({
      imageBuffer,
      mimeType: file.mimetype,
      title: typeof req.body?.title === 'string' ? req.body.title : '',
      description: typeof req.body?.description === 'string' ? req.body.description : '',
      address: typeof req.body?.address === 'string' ? req.body.address : '',
      departments: departments.map((dept) => ({
        id: dept._id.toString(),
        name: dept.name,
        category: dept.category ?? null,
      })),
    });

    res.json(result);
  } catch (error) {
    console.error('[POST /api/ai/image-suggest]', error?.message ?? error);
    res.status(500).json({ error: 'Failed to generate image-based suggestions' });
  } finally {
    if (file?.path) {
      await unlink(file.path).catch(() => undefined);
    }
  }
}
