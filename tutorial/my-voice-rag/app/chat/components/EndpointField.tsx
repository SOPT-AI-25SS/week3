"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function EndpointField({ value, onChange }: Props) {
  return (
    <div className="mb-4">
      <label htmlFor="endpoint" className="block text-sm font-medium mb-1">
        Vertex IndexEndpoint Resource Name
      </label>
      <input
        id="endpoint"
        type="text"
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="projects/123/locations/us-central1/indexEndpoints/456"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
