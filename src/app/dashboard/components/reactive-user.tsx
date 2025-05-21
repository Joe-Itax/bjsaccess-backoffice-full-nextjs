import Spinner from "@/components/spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useUpdateUserMutation } from "@/hooks/use-users";
import { User } from "@/types/user";
import { useState } from "react";

interface ReactiveUserProps {
  row: { original: User };
}

export default function ReactiveUser({ row }: ReactiveUserProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const reactivateUserMutation = useUpdateUserMutation();

  const handleReactivateUser = async () => {
    const user = row.original;
    const formData = new FormData();
    formData.append("userId", user.id);

    try {
      await reactivateUserMutation.mutateAsync(formData);
    } catch (error) {
      console.error("Erreur lors de la réactivation de l'utilisateur:", error);
    } finally {
      setOpenDialog(false);
    }
  };

  return (
    <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          className="text-blue-500 focus:text-blue-700"
          onSelect={(e) => e.preventDefault()}
        >
          <span>Réactiver l&apos;utilisateur</span>
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la réactivation</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir réactiver{" "}
            <b>
              {row.original.name} ({row.original.role}){" "}
            </b>
            du back-office ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <Button
            onClick={handleReactivateUser}
            disabled={reactivateUserMutation.isPending}
          >
            {reactivateUserMutation.isPending ? "Réactivation..." : "Réactiver"}
            {reactivateUserMutation.isPending && <Spinner />}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
