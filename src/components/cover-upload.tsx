import { useRef, useState } from 'react'

// Cover-afbeelding uploaden: klikken of slepen. Stuurt het bestand naar
// /api/cover en geeft het opgeslagen pad terug via `onChange`. De url is
// hetzelfde veld als voorheen (cover_afbeelding_url), alleen vult de gebruiker
// het niet meer met de hand. De afmetingen komen mee omdat de banner op de
// eventpagina daarmee bepaalt of hij de flyer bijsnijdt of heel laat zien.
export type Cover = {
  url: string
  breedte: number | null
  hoogte: number | null
}

export const LEGE_COVER: Cover = { url: '', breedte: null, hoogte: null }

type Props = {
  value: Cover
  onChange: (cover: Cover) => void
  // `groot` = de brede dropzone uit het publieke event-formulier.
  groot?: boolean
}

export function CoverUpload({ value, onChange, groot }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [sleept, setSleept] = useState(false)

  async function upload(file: File | undefined) {
    if (!file) return
    setFout(null)
    setBezig(true)
    try {
      const body = new FormData()
      body.append('bestand', file)
      const res = await fetch('/api/cover', { method: 'POST', body })
      const data = (await res.json()) as Partial<Cover> & { error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload mislukt')
      onChange({
        url: data.url,
        breedte: data.breedte ?? null,
        hoogte: data.hoogte ?? null,
      })
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Upload mislukt')
    } finally {
      setBezig(false)
      // Leegmaken, anders vuurt onChange niet als je hetzelfde bestand opnieuw kiest.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const hoogte = groot ? 'h-[190px]' : 'h-[130px]'

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      {value.url ? (
        <div className="flex flex-col gap-2">
          <div
            className={`w-full overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-[#F1F5F9] bg-cover bg-center ${hoogte}`}
            style={{ backgroundImage: `url(${value.url})` }}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={bezig}
              className="text-[13px] font-semibold text-[#2563EB] hover:underline disabled:opacity-50"
            >
              {bezig ? 'Bezig met uploaden…' : 'Vervangen'}
            </button>
            <button
              type="button"
              onClick={() => onChange(LEGE_COVER)}
              className="text-[13px] font-semibold text-[#DC2626] hover:underline"
            >
              Verwijderen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setSleept(true)
          }}
          onDragLeave={() => setSleept(false)}
          onDrop={(e) => {
            e.preventDefault()
            setSleept(false)
            void upload(e.dataTransfer.files[0])
          }}
          disabled={bezig}
          className={`flex w-full flex-col items-center justify-center rounded-[14px] border-2 border-dashed p-6 text-center transition-colors disabled:opacity-60 ${hoogte} ${
            sleept ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8]'
          }`}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.8"
            className="mb-2.5 block"
          >
            <path d="M12 16V4M12 4 7 9M12 4l5 5" />
            <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <div className="text-[13.5px] font-bold text-[#334155]">
            {bezig ? 'Bezig met uploaden…' : 'Sleep een afbeelding hierheen of klik om te uploaden'}
          </div>
          <div className="mt-1 text-[12px] text-[#94A3B8]">PNG, JPG of WEBP tot 5MB — aanbevolen 1200×600</div>
        </button>
      )}

      {fout && <p className="text-[13px] font-semibold text-[#DC2626]">{fout}</p>}
    </div>
  )
}
