import React, { useEffect, useState } from "react";
import { Lead } from "../../shared/types/index.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ApiClient } from "../services/api.js";

export const ProspectsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLeads = (queryStr = "") => {
    setLoading(true);
    ApiClient.getProspects({ search: queryStr })
      .then((res) => setLeads(res.leads))
      .catch(console.error)
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
          placeholder="Search by company name, contact, or location..."
          value={search}
          onChange={handleSearchChange}
          style={{ width: "360px" }}
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
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                  Loading prospects...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                  No prospects found.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const phone = lead.contacts?.find((c) => c.isPrimary)?.normalizedValue || "N/A";
                return (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{lead.companyName}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{lead.businessType || "Real Estate"}</div>
                    </td>
                    <td>{lead.contactName || "—"}</td>
                    <td>{lead.location || "Nigeria"}</td>
                    <td>
                      <StatusBadge status={lead.pipelineStage} />
                    </td>
                    <td>{phone}</td>
                    <td>
                      <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => onNavigate("/conversations")}>
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
