import { useRetryJobs } from "@/hooks/useRetryJobs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

function statusBadge(status: string, attemptCount: number, maxAttempts: number) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case "retrying":
      return (
        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Retrying ({attemptCount}/{maxAttempts})
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" />
          Pending ({attemptCount}/{maxAttempts})
        </Badge>
      );
  }
}

export function RetryJobsPanel() {
  const { data: jobs, isLoading, error } = useRetryJobs();

  if (isLoading) {
    return (
      <div className="p-6 border border-border rounded-sm bg-card">
        <p className="text-sm text-muted-foreground">Loading retry jobs…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-border rounded-sm bg-card">
        <p className="text-sm text-destructive">Failed to load retry jobs.</p>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="p-6 border border-border rounded-sm bg-card">
        <h3 className="font-display text-base text-primary mb-1">Tradera Retry Queue</h3>
        <p className="text-sm text-muted-foreground">No retry jobs found. The queue is empty.</p>
      </div>
    );
  }

  return (
    <div className="p-6 border border-border rounded-sm bg-card">
      <h3 className="font-display text-base text-primary mb-1">Tradera Retry Queue</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Read-only view of background retry jobs for rate-limited Tradera imports.
      </p>

      <div className="rounded-sm border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs uppercase tracking-wider">Source Ref</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Next Retry</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Error</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id} className="text-sm">
                <TableCell className="font-mono text-xs">{job.source_ref}</TableCell>
                <TableCell>{statusBadge(job.status, job.attempt_count, job.max_attempts)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {job.status === "completed" || job.status === "failed"
                    ? "—"
                    : format(new Date(job.retry_after), "MMM d, HH:mm")}
                </TableCell>
                <TableCell className="text-xs text-destructive/80 max-w-[200px] truncate">
                  {job.last_error || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(job.created_at), "MMM d, HH:mm")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
