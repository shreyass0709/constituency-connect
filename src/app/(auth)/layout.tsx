import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <Link href="/" className="font-heading text-2xl font-semibold tracking-tight">
        Constituency<span className="text-primary"> Connect</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
