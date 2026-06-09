import { getAccessToken } from './auth';

async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += ` and 'root' in parents`;
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function createFolder(name: string, parentId?: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');

  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  const data = await res.json();
  return data.id;
}

export async function uploadExcelToDrive(fileName: string, arrayBuffer: ArrayBuffer) {
  const token = await getAccessToken();
  if (!token) {
    console.warn("User not authenticated to Google Drive. Skipping export.");
    return false;
  }

  // 1. Get or create "church-related" in root
  let churchRelatedId = await findFolder('church-related');
  if (!churchRelatedId) {
    churchRelatedId = await createFolder('church-related');
  }

  // 2. Get or create "Others" inside "church-related"
  let othersId = await findFolder('Others', churchRelatedId);
  if (!othersId) {
    othersId = await createFolder('Others', churchRelatedId);
  }

  // 3. Find if the file already exists in "Others"
  const query = `name = '${fileName}' and '${othersId}' in parents and trashed = false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await res.json();
  const existingFileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Use multipart upload
  const form = new FormData();
  
  if (existingFileId) {
    // PATCH /upload/drive/v3/files/{fileId}
    const url = new URL(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`);
    const updateRes = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      body: blob
    });
    if (!updateRes.ok) throw new Error('Failed to update file in Drive');
  } else {
    // POST /upload/drive/v3/files?uploadType=multipart
    const metadata = {
      name: fileName,
      parents: [othersId]
    };
    
    // Create multipart body manually to support Google Drive APIs expectations cleanly
    const boundary = 'foo_bar_baz_' + Date.now();
    
    let body = '--' + boundary + '\r\n';
    body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
    body += JSON.stringify(metadata) + '\r\n';
    body += '--' + boundary + '\r\n';
    body += 'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n';
    
    // We need to construct the HTTP body with a mix of string and binary array buffer.
    const bodyHeaderStr = new TextEncoder().encode(body);
    const bodyFooterStr = new TextEncoder().encode('\r\n--' + boundary + '--');
    
    const combinedLength = bodyHeaderStr.length + arrayBuffer.byteLength + bodyFooterStr.length;
    const combinedBuffer = new Uint8Array(combinedLength);
    combinedBuffer.set(bodyHeaderStr, 0);
    combinedBuffer.set(new Uint8Array(arrayBuffer), bodyHeaderStr.length);
    combinedBuffer.set(bodyFooterStr, bodyHeaderStr.length + arrayBuffer.byteLength);

    const postRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: combinedBuffer
    });
    if (!postRes.ok) {
        const txt = await postRes.text();
        throw new Error('Failed to create file in Drive: ' + txt);
    }
  }
  return true;
}
