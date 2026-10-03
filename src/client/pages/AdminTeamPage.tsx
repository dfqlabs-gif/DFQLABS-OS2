import React, { useEffect, useState } from "react";
import { OutreachSeat, User } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

export const AdminTeamPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [seats, setSeats] = useState<OutreachSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchTeam = () => {
    setLoading(true);
    ApiClient.getTeam()
      .then((res) => {
        setUsers(res.users);
        setSeats(res.seats);
      })
      .catch((err) => addToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleReassign = async (seatId: string, currentUserId: string | null) => {
    const nextUser = users.find((u) => u.id !== currentUserId && u.role === "OUTREACH_SPECIALIST") || users[0];
    if (!nextUser) return;

    try {
      await ApiClient.reassignSeat(seatId, nextUser.id);
      fetchTeam();
      addToast(`Seat reassigned to ${nextUser.fullName}`, "success");
    } catch (e) {
      addToast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: "24px" }}>
        <h3 style={{ marginTop: 0, fontSize: "16px", fontWeight: 700 }}>Outreach Capacity Seats ({seats.length})</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
          Seats represent operational capacity slots. Reassigning a seat updates active lead ownership while preserving historical activity logs under the original user ID.
        </p>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Seat Code</th>
                <th>Display Name</th>
                <th>Assigned User</th>
                <th>Daily Target</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: "20px" }}>
                    <Skeleton height="30px" />
                  </td>
                </tr>
              ) : (
                seats.map((seat) => {
                  const assigned = users.find((u) => u.id === seat.currentUserId);
                  return (
                    <tr key={seat.id}>
                      <td style={{ fontWeight: 700, color: "var(--accent-glacier)" }}>{seat.seatCode}</td>
                      <td>{seat.displayName}</td>
                      <td>{assigned ? `${assigned.fullName} (${assigned.email})` : "Unassigned"}</td>
                      <td>{seat.dailyOutreachTarget} / day</td>
                      <td>
                        <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => handleReassign(seat.id, seat.currentUserId)}>
                          Reassign Seat
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: "16px", fontWeight: 700 }}>Team Identity Registry ({users.length})</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.fullName}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{u.email}</td>
                  <td>
                    <span className={`role-badge ${u.role === "FOUNDER" ? "role-founder" : "role-specialist"}`}>{u.role}</span>
                  </td>
                  <td style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>ACTIVE</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
