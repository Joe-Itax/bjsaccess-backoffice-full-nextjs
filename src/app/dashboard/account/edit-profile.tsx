"use client";

import { useId, useRef, useState, type InputHTMLAttributes } from "react";
import {
  EditIcon,
  ImagePlusIcon,
  MailIcon,
  PhoneIcon,
  CakeIcon,
  ShieldCheckIcon,
  LockIcon,
} from "lucide-react";
import { useCharacterLimit } from "@/hooks/use-character-limit";
import { FileWithPreview, useFileUpload } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import { useNotification } from "@/hooks/use-notification";

const initialAvatarImage = [
  {
    name: "avatar.jpg",
    size: 1528737,
    type: "image/jpeg",
    url: "/avatar.jpg",
    id: "avatar-123456789",
  },
];

export default function EditProfile() {
  const id = useId();
  const [openDialog, setOpenDialog] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [{ files }, { openFileDialog, getInputProps }] = useFileUpload({
    accept: "image/*",
    initialFiles: initialAvatarImage,
  });
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;
  const maxLength = 180;
  const { value, characterCount, handleChange } = useCharacterLimit({
    maxLength,
    initialValue: "Administrateur de la plateforme BJS Access",
  });
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const { show } = useNotification();

  const handleSubmit = async () => {
    setIsPending(true);
    if (!user) return;

    const formData = new FormData();

    const name = nameRef.current?.value || user.name;
    const email = emailRef.current?.value || user.email;
    const currentPassword = currentPasswordRef.current?.value;
    const newPassword = newPasswordRef.current?.value;
    const file = files[0]?.file;

    try {
      formData.append("action", "update");
      formData.append("name", name);
      formData.append("email", email);

      if (file) {
        formData.append("avatar", file as Blob);
      }

      if (currentPassword && newPassword) {
        formData.append("currentPassword", currentPassword as string);
        formData.append("newPassword", newPassword as string);
      }

      // Must revalidate currentUser after
      const res = await fetch("/api/user", {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();
      console.log("data from handleSubmitUpdateProfile - 96 line: ", data);
      if (!res.ok) throw new Error(data.message || "Une erreur s’est produite");

      refetch();
      show("success", "Votre profil a été mis à jour avec succès.");
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error);
    } finally {
      setOpenDialog(false);
      setIsPending(false);
    }
  };

  return (
    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex gap-2">
          Modifier le profil
          <EditIcon size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Modifier le profil</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[80vh]">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start gap-4">
              <AvatarSection
                files={files}
                openFileDialog={openFileDialog}
                getInputProps={getInputProps}
              />

              <div className="flex-1">
                <h3 className="text-lg font-semibold">{user?.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={"outline"} className="px-2 py-0.5">
                    <ShieldCheckIcon className="size-4 text-primary mr-1" />
                    {user?.role}
                  </Badge>
                </div>
              </div>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-name`}>
                    <span className="flex items-center gap-2">
                      <span>Nom complet</span>
                    </span>
                  </Label>
                  <Input
                    id={`${id}-name`}
                    defaultValue={user?.name}
                    placeholder="Nom complet"
                    type="text"
                    ref={nameRef}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-email`}>
                    <span className="flex items-center gap-2">
                      <MailIcon size={16} />
                      <span>Email</span>
                    </span>
                  </Label>
                  <Input
                    id={`${id}-email`}
                    defaultValue={user?.email}
                    type="email"
                    ref={emailRef}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-password`}>
                    <span className="flex items-center gap-2">
                      <LockIcon size={16} />
                      <span>Ancien Password</span>
                    </span>
                  </Label>
                  <Input
                    id={`${id}-password`}
                    defaultValue={""}
                    type="password"
                    ref={currentPasswordRef}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-password`}>
                    <span className="flex items-center gap-2">
                      <LockIcon size={16} />
                      <span>Nouveau password</span>
                    </span>
                  </Label>
                  <Input
                    id={`${id}-password`}
                    defaultValue={""}
                    type="password"
                    ref={newPasswordRef}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-phone`}>
                    <span className="flex items-center gap-2">
                      <PhoneIcon size={16} />
                      <span>Téléphone</span>
                    </span>
                  </Label>
                  <Input
                    id={`${id}-phone`}
                    defaultValue="(+243) 97 78 73 421"
                    type="tel"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-dob`}>
                    <span className="flex items-center gap-2">
                      <CakeIcon size={16} />
                      <span>Date de naissance</span>
                    </span>
                  </Label>
                  <Input
                    id={`${id}-dob`}
                    defaultValue="12-10-1990"
                    type="date"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-role`}>Rôle</Label>
                  <Input
                    id={`${id}-role`}
                    defaultValue={user?.role}
                    type="text"
                    disabled
                  />
                </div>
              </div>

              <div className="pt-2">
                <Label htmlFor={`${id}-bio`}>Biographie</Label>
                <Textarea
                  id={`${id}-bio`}
                  defaultValue={value}
                  onChange={handleChange}
                  maxLength={maxLength}
                  className="min-h-[100px]"
                  disabled
                />
                <p className="text-muted-foreground text-xs text-right mt-1">
                  {maxLength - characterCount} caractères restants
                </p>
              </div>
            </form>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>
            {isPending ? "En cours..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface avatarSectionProps {
  files?: FileWithPreview[];
  openFileDialog: () => void;
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>
  ) => InputHTMLAttributes<HTMLInputElement> & {
    ref: React.Ref<HTMLInputElement>;
  };
}
function AvatarSection({
  files,
  openFileDialog,
  getInputProps,
}: avatarSectionProps) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const avatarFallback = user?.name
    .split(" ")
    .map((name) => name[0])
    .join("");

  const currentImage =
    files?.[0]?.preview || user?.image || "/placeholder-avatar.png";

  return (
    <div className="relative">
      <div className="relative size-20 rounded-full border-2 border-white shadow-md overflow-hidden">
        <Avatar className="size-full rounded-full">
          <AvatarImage
            className="object-cover"
            src={currentImage}
            alt={user?.name}
          />
          <AvatarFallback className="rounded-full text-xl">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
      </div>
      <button
        type="button"
        className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5 text-white shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
        onClick={openFileDialog}
      >
        <ImagePlusIcon size={16} />
      </button>
      <input {...getInputProps()} className="sr-only" />
    </div>
  );
}
