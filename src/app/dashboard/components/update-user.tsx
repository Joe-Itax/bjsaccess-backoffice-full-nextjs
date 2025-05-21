"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PencilLineIcon } from "lucide-react";

import { useAdminUpdateUserMutation } from "@/hooks/use-users";
import { User } from "@/types/user";
import Spinner from "@/components/spinner";

type UserFormData = {
  role: "ADMIN" | "AUTHOR";
  isActive: boolean;
};

interface UpdateUserProps {
  user: User;
}

export default function UpdateUserByAdmin({ user }: UpdateUserProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const { mutateAsync: adminUpdateUserMutation, isPending } =
    useAdminUpdateUserMutation();
  const [formData, setFormData] = useState<UserFormData>({
    role: (user.role as "ADMIN" | "AUTHOR") || "AUTHOR",
    isActive: user.isActive,
  });
  const [errors, setErrors] = useState<Partial<UserFormData>>({});

  //   const { mutateAsync: createUser, isPending } = useAddUserMutation();

  const validateForm = (): boolean => {
    const newErrors: Partial<UserFormData> = {};

    // const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    const formUpdateUser = new FormData();
    formUpdateUser.append("role", formData.role);
    formUpdateUser.append("isActive", formData.isActive.toString());

    try {
      const userUpdated = await adminUpdateUserMutation({
        id: user.id,
        formData: formUpdateUser,
      });

      setFormData({
        role: (userUpdated.user.role as "ADMIN" | "AUTHOR") || "AUTHOR",
        isActive: userUpdated.user.isActive,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setOpenDialog(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user types
    if (errors[name as keyof UserFormData]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  return (
    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogTrigger asChild>
        <Button className="" variant="outline">
          <PencilLineIcon
            className="-ms-1 opacity-60"
            size={16}
            aria-hidden="true"
          />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Mettre à jour l&apos;utilisateur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">Rôle *</Label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="AUTHOR">Auteur</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="space-y-2 flex items-center gap-4">
            <Label htmlFor="isActif">Status (Actif ou désactiver)</Label>
            <input
              id="isActif"
              name="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className={`p-2 border rounded ${
                errors.isActive ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.isActive && (
              <p className="text-red-500 text-sm">{errors.isActive}</p>
            )}
          </div>
        </div>
        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Updating..." : "Update"}
            {isPending && <Spinner />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
