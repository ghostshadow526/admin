import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { auth } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

type RiceListing = {
  id: string;
  imageUrl: string;
  description: string;
  price: number;
};

interface BuyRicePageProps {
  onNavigate?: (page: 'dashboard' | 'admins' | 'gallery' | 'buy-rice') => void;
}

export default function BuyRicePage({ onNavigate }: BuyRicePageProps) {
  const [items, setItems] = useState<RiceListing[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const backendUrl = useMemo(() => {
    return (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001';
  }, []);

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

  const fetchListings = async () => {
    const response = await fetch(`${backendUrl}/api/buy-rice/public`, {
      method: 'GET',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to load listings');
    }

    const next: RiceListing[] = Array.isArray(data?.items)
      ? data.items
          .filter((d: any) => typeof d?.imageUrl === 'string')
          .map((d: any) => ({
            id: String(d.id),
            imageUrl: String(d.imageUrl || ''),
            description: String(d.description || ''),
            price: Number(d.price || 0),
          }))
      : [];
    setItems(next);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchListings();
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : 'Failed to load listings');
      } finally {
        setLoading(false);
      }
    })();
  }, [backendUrl]);

  const uploadToImageKit = async (file: File) => {
    const idToken = await getToken();
    const authRes = await fetch(`${backendUrl}/api/imagekit-auth`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const authPayload = await authRes.json();
    if (!authRes.ok) {
      throw new Error(authPayload?.message || 'Failed to get ImageKit upload credentials');
    }

    const { token, expire, signature, publicKey } = authPayload || {};
    if (!token || !expire || !signature || !publicKey) {
      throw new Error('Invalid ImageKit auth response');
    }

    const form = new FormData();
    form.append('file', file);
    form.append('fileName', file.name);
    form.append('publicKey', publicKey);
    form.append('signature', signature);
    form.append('expire', String(expire));
    form.append('token', token);

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

  const createListing = async (imageUrl: string, nextDescription: string, nextPrice: number) => {
    const token = await getToken();
    const response = await fetch(`${backendUrl}/api/buy-rice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageUrl, description: nextDescription, price: nextPrice }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to create listing');
    }
  };

  const handleCreate = async () => {
    if (!selectedFile) {
      toast.error('Select an image');
      return;
    }
    if (!description.trim()) {
      toast.error('Enter a description');
      return;
    }
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Enter a valid price');
      return;
    }

    try {
      setSubmitting(true);
      const imageUrl = await uploadToImageKit(selectedFile);
      await createListing(imageUrl, description.trim(), parsedPrice);
      await fetchListings();
      setSelectedFile(null);
      setDescription('');
      setPrice('');
      const input = document.getElementById('buy-rice-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
      toast.success('Listing created');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteListing = async (id: string) => {
    const ok = window.confirm('Delete this listing?');
    if (!ok) return;

    const token = await getToken();
    const response = await fetch(`${backendUrl}/api/buy-rice/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to delete listing');
    }
  };

  return (
    <div className="container-fluid p-0">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">
          <strong>Buy Rice</strong>
        </h1>
        <button onClick={() => onNavigate?.('dashboard')} className="btn btn-outline-secondary">
          ← Back to Dashboard
        </button>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <h5 className="card-title mb-0">Create Listing</h5>
        </div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Image</label>
              <input
                id="buy-rice-file-input"
                className="form-control"
                type="file"
                accept="image/*"
                disabled={submitting}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label">Description</label>
              <input
                className="form-control"
                type="text"
                placeholder="e.g. 50kg Premium Rice"
                value={description}
                disabled={submitting}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Price</label>
              <input
                className="form-control"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={price}
                disabled={submitting}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="col-12 d-grid mt-2">
              <button className="btn btn-primary" disabled={submitting} onClick={handleCreate}>
                {submitting ? 'Saving...' : 'Save Listing'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Listings</h5>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted mb-0">No listings yet</p>
          ) : (
            <div className="row g-3">
              {items.map((item) => (
                <div key={item.id} className="col-12 col-md-6 col-xl-4">
                  <div className="card mb-0">
                    <img
                      src={item.imageUrl}
                      className="card-img-top"
                      style={{ objectFit: 'cover', height: 200 }}
                      alt={item.description}
                    />
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-bold">{item.description}</div>
                          <div className="text-muted">${item.price.toFixed(2)}</div>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={async () => {
                            try {
                              await deleteListing(item.id);
                              await fetchListings();
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
