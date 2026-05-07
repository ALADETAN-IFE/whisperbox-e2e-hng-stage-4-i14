export default function LoadingSpinner() {
  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[#3390ec] border-t-transparent animate-spin" />
    </div>
  );
}
