import { ReviewEditor } from "@/components/scan/ReviewEditor";

export default function ReviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif-heading text-3xl">Review</h1>
      <ReviewEditor />
    </div>
  );
}
