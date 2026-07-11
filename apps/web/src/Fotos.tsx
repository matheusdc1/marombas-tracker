import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2, Upload, X } from 'lucide-react'
import { apiUrl, deletePhoto, getPhotos, todayIso, uploadPhoto } from './api'
import { PHOTO_CATEGORIES } from './types'
import type { Photo, PhotoCategory } from './types'

export default function Fotos() {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [error, setError] = useState('')
  const [day, setDay] = useState(todayIso())
  const [category, setCategory] = useState<PhotoCategory>('Frente')
  const [file, setFile] = useState<File | null>(null)
  const [compare, setCompare] = useState<number[]>([])

  async function load() {
    try {
      setError('')
      setPhotos(await getPhotos())
    } catch {
      setError('Não consegui carregar as fotos. A API está rodando em :8000?')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    try {
      setError('')
      await uploadPhoto(day, category, file as File)
      setFile(null)
      form.reset()
      await load()
    } catch {
      setError('Falha ao enviar a foto. A API está rodando em :8000?')
    }
  }

  function toggleCompare(id: number) {
    setCompare((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length < 2 ? [...c, id] : c,
    )
  }

  const pair =
    photos && compare.length === 2
      ? compare.map((id) => photos.find((p) => p.id === id)!)
      : null

  return (
    <section className="fotos">
      <h2>Fotos de evolução</h2>
      <p className="muted">
        Registre fotos de frente, lado e costas — clique em duas para comparar datas.
      </p>
      {error && <p className="error">{error}</p>}
      <form className="add-form" onSubmit={submit}>
        <input
          aria-label="data da foto"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <select
          aria-label="categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value as PhotoCategory)}
        >
          {PHOTO_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          aria-label="arquivo da foto"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button aria-label="enviar foto" disabled={!file}>
          <Upload size={16} aria-hidden />
          Enviar
        </button>
      </form>
      {pair && (
        <div className="compare">
          {pair.map((p) => (
            <figure key={p.id}>
              <img src={apiUrl(p.url)} alt={`${p.category} em ${p.day}`} />
              <figcaption>
                {p.day} · {p.category}
              </figcaption>
            </figure>
          ))}
          <button
            className="ghost"
            aria-label="limpar comparação"
            onClick={() => setCompare([])}
          >
            <X size={14} aria-hidden />
            Limpar comparação
          </button>
        </div>
      )}
      {!photos && !error && <p>Carregando…</p>}
      {photos && photos.length === 0 && (
        <p className="empty">Nenhuma foto ainda — envie a primeira acima.</p>
      )}
      {photos &&
        [...new Set(photos.map((p) => p.day))].map((d) => (
          <section key={d} className="photo-day">
            <h3>{d}</h3>
            <div className="photos-grid">
              {photos
                .filter((p) => p.day === d)
                .map((p) => (
                  <figure
                    key={p.id}
                    className={`photo-card${compare.includes(p.id) ? ' selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="photo-pick"
                      aria-label={`comparar foto ${p.id}`}
                      onClick={() => toggleCompare(p.id)}
                    >
                      <img src={apiUrl(p.url)} alt={`${p.category} em ${p.day}`} />
                    </button>
                    <figcaption>
                      {p.category}
                      <button
                        aria-label={`remover foto ${p.id}`}
                        onClick={() => void deletePhoto(p.id).then(load)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </figcaption>
                  </figure>
                ))}
            </div>
          </section>
        ))}
    </section>
  )
}
