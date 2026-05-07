export default function ChatIndexPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0e1621] relative">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10l5 5m10-5l-5 5m30 0l5 5m10-5l-5 5m-50 40l5 5m10-5l-5 5m30 0l5 5m10-5l-5 5' stroke='%23ffffff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="bg-black/30 px-4 py-2 rounded-full text-sm text-white relative z-10">
        Select a chat to start messaging
      </div>
    </div>
  );
}
