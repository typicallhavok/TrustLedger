import { NextResponse } from 'next/server';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';


export async function POST(request: Request) {
  const evidenceDir = join(process.cwd(), 'evidence');
  mkdirSync(evidenceDir, { recursive: true });

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file received' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = join(evidenceDir, file.name);

    await new Promise<void>((resolve, reject) =>
      createWriteStream(path)
        .on('finish', () => resolve())
        .on('error', (err) => reject(err))
        .end(buffer)
    );

    return NextResponse.json({ message: 'File saved locally' });
  } catch (error) {
    console.error('File save error:', error);
    return NextResponse.json(
      { error: 'Failed to save file' },
      { status: 500 }
    );
  }
}