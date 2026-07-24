import { useId, useRef, useState, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileDropzoneProps {
  /** Atributo accept del input (p. ej. "application/pdf"). */
  accept: string;
  multiple?: boolean;
  /** Texto descriptivo bajo el icono. */
  hint: string;
  onFiles: (files: File[]) => void;
}

export function FileDropzone({ accept, multiple = false, hint, onFiles }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-instrument)] border-2 border-dashed px-6 py-14 text-center transition-all duration-200 ${
        dragging
          ? 'scale-[1.01] border-solid border-signal bg-signal/10'
          : 'border-line bg-paper-raised hover:border-signal/50 hover:bg-signal/5'
      }`}
    >
      <span className={`grid size-12 place-items-center rounded-full text-signal-deep transition-transform ${dragging ? 'scale-110 bg-signal/20' : 'doclab-dropzone-icon bg-ink/5'}`}>
        <UploadCloud className="size-6" aria-hidden />
      </span>
      <span className="font-display text-lg font-600 text-ink">
        {dragging ? '¡Suéltalo aquí!' : `Arrastra ${multiple ? 'tus archivos' : 'tu archivo'} aquí`}
      </span>
      <span className="max-w-sm text-sm text-graphite">{hint}</span>
      <span className="mt-1 font-mono text-[11px] text-graphite">o haz clic para seleccionar</span>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
  );
}
