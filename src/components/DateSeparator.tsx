export default function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-2">
      <span className="bg-[#1c2e3e] text-[#8ab4d4] text-[12px] px-3 py-1 rounded-full">
        {label}
      </span>
    </div>
  );
}
