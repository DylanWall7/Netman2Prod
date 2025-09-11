import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";

export default function UserProfile() {
  const { instance, accounts } = useMsal();
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    if (accounts.length === 0) return;

    const request = {
      scopes: ["User.Read"],
      account: accounts[0],
    };

    async function fetchData() {
      try {
        const response = await instance.acquireTokenSilent(request);
        const token = response.accessToken;

        const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profileData = await profileRes.json();
        setUser(profileData);

        const photoRes = await fetch(
          "https://graph.microsoft.com/v1.0/me/photo/$value",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (photoRes.ok) {
          const blob = await photoRes.blob();
          const reader = new FileReader();
          reader.onloadend = () => setAvatar(reader.result);
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.error(err);
      }
    }

    fetchData();
  }, [accounts, instance]);

  if (!user) {
    return <div className="p-6 text-pink-300">Loading profile...</div>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto text-pink-200">
      <div className=" bg-pink-300  rounded-2xl shadow-lg p-6">
        <div className="flex items-center space-x-6">
          {avatar ? (
            <img
              src={avatar}
              alt="User Avatar"
              className="w-24 h-24 rounded-full border-2 border-pink-400 shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-pink-700 flex items-center justify-center text-xl">
              {user.displayName?.[0]}
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold">{user.displayName}</h2>
            <p className="text-pink-400">
              {user.mail || user.userPrincipalName}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p>
            <span className="font-semibold">Job Title:</span>{" "}
            {user.jobTitle || "—"}
          </p>
          <p>
            <span className="font-semibold">Department:</span>{" "}
            {user.officeLocation || "—"}
          </p>
          <p>
            <span className="font-semibold">Phone:</span> {user.mobilePhone}
          </p>
        </div>
      </div>
    </div>
  );
}
