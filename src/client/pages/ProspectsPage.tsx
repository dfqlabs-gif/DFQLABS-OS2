import React, { useEffect, useState } from "react";
import { Lead } from "../../shared/types/index.js";
import { Skeleton } from "../components/Skeleton.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useToast } from "../context/ToastContext.js";
import { ApiClient } from "../services/api.js";

export const ProspectsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { addToast } = useToast();

  const fetchLeads = (queryStr = "") => {
    setLoading(true);
    ApiClient.getProspects({ search: queryStr })
      .then((res) => setLeads(res.leads))
      .catch((err) => addToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    fetchLeads(val);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search company name, contact, or location..."
          value={search}
          onChange={handleSearchChange}
          style={{ width: "380px" }}
        />
        <button className="btn-primary" onClick={() => onNavigate("/prospects/new")}>
          ➕ Add Prospect
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact Name</th>
              <th>Location</th>
              <th>Stage</th>
              <th>WhatsApp / Phone</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: "20px" }}>
                  <Skeleton height="30px" />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "32px" }}>
                  No prospects found matching your query.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const phone = lead.contacts?.find((c) => c.isPrimary)?.normalizedValue || "N/A";
                return (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{lead.companyName}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{lead.businessType || "Real Estate"}</div>
                    </td>
                    <td>{lead.contactName || "—"}</td>
                    <td>{lead.location || "Nigeria"}</td>
                    <td>
                      <StatusBadge status={lead.pipelineStage} />
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{phone}</td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                        onClick={() => onNavigate(`/prospects/${lead.id}`)}
                      >
                        Open Conversation
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
  );
};
