import Spinner from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { CircleAlertIcon } from "lucide-react";

interface dataStatusDisplayProps {
  isPending: boolean;
  hasError: boolean;
  errorObject?: Error | null;
  refetch: () => void;
}

export default function DataStatusDisplay({
  isPending,
  hasError,
  errorObject,
  refetch,
}: dataStatusDisplayProps) {
  if (isPending) {
    return (
      <div className="w-full py-64 flex justify-center items-center">
        <div className="flex gap-4 items-center">
          Chargement... <Spinner />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <CircleAlertIcon className="text-destructive" size={48} />
        <h2 className="text-2xl font-bold text-red-600">
          Oups ! Une erreur est survenue.
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Il semble que quelque chose se soit mal passé lors du chargement des
          données.
          {/* Display a more specific error message if available */}
          {errorObject && errorObject.message && (
            <span className="block mt-2 font-medium">
              Détail: {errorObject.message}
            </span>
          )}
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            await refetch();
          }}
          className="mt-4"
        >
          Réessayer
        </Button>
        <p className="text-sm text-gray-500 mt-2">
          Si le problème persiste, veuillez contacter l&apos;administrateur.
        </p>
      </div>
    );
  }
  return null;
}
