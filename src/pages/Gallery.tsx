import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  auth,
} from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { readJson, withBackend } from '../api/backend';

type GalleryItem = {
  id: string;
  url: string;
};

interface GalleryPageProps {
  currentEmail: string;
}

export default function GalleryPage({ currentEmail }: GalleryPageProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const waitForUser = async () => {
    if (auth.currentUser) return auth.currentUser;

    return await new Promise<User>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error('Not authenticated'));
      }, 5000);

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(user);
        }
      });
    });
  };

  const getToken = async () => {
    const user = await waitForUser();
    return await user.getIdToken();
  };

  const fetchGallery = async () => {
    const response = await fetch(withBackend('/api/gallery/public'), {
      method: 'GET',
    });
    const data = await readJson<any>(response);
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to load gallery');
    }

    const next: GalleryItem[] = Array.isArray(data?.items)
      ? data.items
          .filter((d: any) => typeof d?.url === 'string' && d.url.length > 0)
          .map((d: any) => ({ id: String(d.id), url: d.url }))
      : [];
    setItems(next);
  };

  const deleteImage = async (id: string) => {
    const ok = window.confirm('Delete this image?');
    if (!ok) return;

    const token = await getToken();
    const response = await fetch(withBackend(`/api/gallery/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await readJson<any>(response);
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to delete image');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchGallery();
      } catch (error) {
        console.error('Failed to load gallery:', error);
        const message = error instanceof Error ? error.message : 'Failed to load gallery';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const uploadToImageKit = async (file: File) => {
    const token = await getToken();
    const signingResponse = await fetch(withBackend('/api/imagekit-auth'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const signingData = await readJson<any>(signingResponse);
    if (!signingResponse.ok) {
      throw new Error(signingData?.message || 'Failed to sign upload');
    }

    const { token: ikToken, expire, signature, publicKey } = signingData;

    const form = new FormData();
    form.append('file', file);
    form.append('fileName', file.name);
    form.append('publicKey', publicKey);
    form.append('signature', signature);
    form.append('expire', String(expire));
    form.append('token', ikToken);

    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: form,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || 'Image upload failed');
    }

    if (!payload?.url) {
      throw new Error('Upload succeeded but no URL returned');
    }

    return payload.url as string;
  };

  const saveUrl = async (url: string) => {
    const token = await getToken();
    const response = await fetch(withBackend('/api/gallery'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
    });
    const data = await readJson<any>(response);
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to save URL');
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Select at least one image');
      return;
    }

    try {
      setUploading(true);

      for (const file of selectedFiles) {
        const url = await uploadToImageKit(file);
        await saveUrl(url);
      }

      await fetchGallery();

      toast.success('Uploaded successfully');
      setSelectedFiles([]);
      const input = document.getElementById('gallery-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container-fluid p-0">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">
          <strong>Gallery</strong>
        </h1>
        <div className="text-muted">Signed in as {currentEmail}</div>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <h5 className="card-title mb-0">Upload Images</h5>
        </div>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-8">
              <label className="form-label">Choose images</label>
              <input
                id="gallery-file-input"
                className="form-control"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setSelectedFiles(files);
                }}
                disabled={uploading}
              />
              <small className="form-text text-muted">
                Images are stored in ImageKit. Only the URL is saved in Firebase.
              </small>
            </div>
            <div className="col-12 col-md-4 d-grid">
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading ? 'Uploading...' : `Upload (${selectedFiles.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Images</h5>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted mb-0">No images uploaded yet.</p>
          ) : (
            <div className="row">
              {items.map((item) => (
                <div key={item.id} className="col-12 col-sm-6 col-md-4 col-lg-3 mb-3">
                  <div className="card h-100">
                    <img
                      src={item.url}
                      alt="Gallery"
                      className="card-img-top"
                      style={{ objectFit: 'cover', height: 180 }}
                      loading="lazy"
                    />
                    <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <a href={item.url} target="_blank" rel="noreferrer" className="small">
                Open image
              </a>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={async () => {
                  try {
                    await deleteImage(item.id);
                    await fetchGallery();
                    toast.success('Deleted');
                  } catch (e: any) {
                    toast.error(e?.message || 'Failed to delete');
                  }
                }}
              >
                Delete
              </button>
            </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
