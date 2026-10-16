
import React, { useState } from "react";
import Pagination, { usePagination } from "../components/Pagination";
import Modal from "../components/Modal";

import {
  money,
  getRate,
  getShiftLabel
} from "../utils/payroll";



const POSITION_DEPARTMENTS = {
  "Payroll Admin": "Finance & Payroll",
  "Marketing Employee": "Marketing",
  "Live Hosts": "Live Selling",
  "Tailor": "Production & Tailoring",
  "Warehouse Staff": "Warehouse & Inventory",
  "Repacker": "Packing & Fulfillment"
};

const POSITIONS = Object.keys(POSITION_DEPARTMENTS);

const DEPARTMENTS = [
  ...new Set(Object.values(POSITION_DEPARTMENTS))
];



const blank = {
  id: "",
  name: "",
  position: "",
  department: "",
  shift: "day6",
  customRate: "",
  active: true
};



export default function Employees({
  data,
  employeeSave,
  employeeDeactivate
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);

  

  const rows = data.employees.filter(employee => {
    const text = `
      ${employee.id}
      ${employee.name}
      ${employee.position}
      ${employee.department}
    `.toLowerCase();

    return (
      text.includes(search.toLowerCase()) &&
      (
        filter === "all" ||
        (
          filter === "active"
            ? employee.active
            : !employee.active
        )
      )
    );
  });

  

  const employeesPage = usePagination(rows);

  function openNew() {
    setForm({ ...blank });
    setEditing(false);
  }

  

  function openEdit(employee) {
    setForm({ ...employee });
    setEditing(true);
  }

  

  function change(event) {
    const { name, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: value
    }));
  }

  

  function changePosition(event) {
    const selectedPosition = event.target.value;

    const assignedDepartment =
      POSITION_DEPARTMENTS[selectedPosition] || "";

    setForm(previous => ({
      ...previous,
      position: selectedPosition,
      department: assignedDepartment
    }));
  }

  

  function submit(event) {
    event.preventDefault();

    if (employeeSave(form, editing)) {
      setForm(null);
    }
  }

  return (
    <div className="page-enter">


      <div className="page-title-row">
        <div>
          <span className="eyebrow">
            THE PEOPLE BEHIND FHILAR
          </span>

          <h1>
            Our lovely team <span>♡</span>
          </h1>

          <p>
            Everyone who brings the FHILAR story to life.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openNew}
        >
          ＋ Add Employee
        </button>
      </div>


      <section className="panel">

        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              TEAM DIRECTORY
            </span>

            <h3>
              Employee records{" "}
              <span className="count-tag">
                {rows.length}
              </span>
            </h3>
          </div>
        </div>


        <div className="toolbar">
          <input
            placeholder="⌕ Search name, position, employee ID..."
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              employeesPage.resetPage();
            }}
          />

          <select
            value={filter}
            aria-label="Filter employees"
            onChange={event => {
              setFilter(event.target.value);
              employeesPage.resetPage();
            }}
          >
            <option value="all">
              All employees
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>


        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>POSITION</th>
                <th>DEPARTMENT</th>
                <th>SHIFT</th>
                <th>HOURLY RATE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {employeesPage.pageItems.map(employee => (
                <tr key={employee.id}>

                  <td>
                    <div className="employee-cell">

                      <span className="employee-avatar">
                        {employee.name?.charAt(0)}
                      </span>

                      <div>
                        <strong>
                          {employee.name}
                        </strong>

                        <small>
                          {employee.id}
                        </small>
                      </div>

                    </div>
                  </td>

                  <td>
                    {employee.position}
                  </td>

                  <td>
                    {employee.department}
                  </td>

                  <td>
                    {getShiftLabel(
                      employee,
                      data.settings
                    )}
                  </td>

                  <td>
                    {money(
                      getRate(
                        employee,
                        data.settings
                      )
                    )}
                  </td>

                  <td>
                    <span
                      className={`status ${
                        employee.active
                          ? "green"
                          : "gray"
                      }`}
                    >
                      {employee.active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </td>

                  <td>
                    <div className="table-actions">

                      <button
                        className="text-button"
                        onClick={() =>
                          openEdit(employee)
                        }
                      >
                        Edit
                      </button>

                      {employee.active && (
                        <button
                          className="text-button danger-text"
                          onClick={() =>
                            setConfirm(employee)
                          }
                        >
                          Deactivate
                        </button>
                      )}

                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>

          {!rows.length && (
            <p className="empty">
              No matching employees found.
            </p>
          )}
        </div>
        <Pagination {...employeesPage} />
      </section>


      {form && (
        <Modal
          title={
            editing
              ? "Edit Employee ♡"
              : "Add a New Employee ✿"
          }
          onClose={() =>
            setForm(null)
          }
        >
          <form
            className="form-grid"
            onSubmit={submit}
          >

    
            <label>
              Employee ID

              <input
                required
                name="id"
                disabled={editing}
                placeholder="EMP-007"
                value={form.id}
                onChange={change}
              />
            </label>

    
            <label>
              Full Name

              <input
                required
                name="name"
                placeholder="Employee name"
                value={form.name}
                onChange={change}
              />
            </label>

    
            <label>
              Position

              <select
                required
                name="position"
                value={form.position}
                onChange={changePosition}
              >
                <option value="">
                  Select position
                </option>

        
                {form.position &&
                  !POSITIONS.includes(form.position) && (
                    <option value={form.position}>
                      {form.position} (Existing)
                    </option>
                  )}

                {POSITIONS.map(position => (
                  <option
                    key={position}
                    value={position}
                  >
                    {position}
                  </option>
                ))}
              </select>
            </label>

    
            <label>
              Department

              <select
                required
                name="department"
                value={form.department}
                onChange={change}
              >
                <option value="">
                  Select department
                </option>

        
                {form.department &&
                  !DEPARTMENTS.includes(form.department) && (
                    <option value={form.department}>
                      {form.department} (Existing)
                    </option>
                  )}

                {DEPARTMENTS.map(department => (
                  <option
                    key={department}
                    value={department}
                  >
                    {department}
                  </option>
                ))}
              </select>
            </label>

    
            <label>
              Assigned Shift

              <select
                name="shift"
                value={form.shift}
                onChange={change}
              >
                {Object.entries(
                  data.settings.shifts
                ).map(([id, shift]) => (
                  <option
                    key={id}
                    value={id}
                  >
                    {getShiftLabel(
                      { shift: id },
                      data.settings
                    )}
                    {" · "}
                    {shift.label}
                  </option>
                ))}
              </select>
            </label>

    
            <label>
              Custom Rate (optional)

              <input
                name="customRate"
                type="number"
                min="0.01"
                step="any"
                value={form.customRate ?? ""}
                onChange={change}
                placeholder="Default shift rate"
              />
            </label>

    
            {editing && (
              <label className="full check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.active)}
                  onChange={event =>
                    setForm({
                      ...form,
                      active: event.target.checked
                    })
                  }
                />

                Active employee
              </label>
            )}

    
            <div className="modal-actions full">

              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  setForm(null)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                Save Employee ♡
              </button>

            </div>
          </form>
        </Modal>
      )}


      {confirm && (
        <Modal
          title="Deactivate this employee?"
          onClose={() =>
            setConfirm(null)
          }
        >
          <p>
            Deactivate{" "}
            <strong>
              {confirm.name}
            </strong>
            ? Their earlier payroll and attendance
            history will remain accessible.
          </p>

          <div className="modal-actions">

            <button
              className="btn btn-outline"
              onClick={() =>
                setConfirm(null)
              }
            >
              Keep Employee
            </button>

            <button
              className="btn btn-primary"
              onClick={() => {
                if (
                  employeeDeactivate(confirm.id)
                ) {
                  setConfirm(null);
                }
              }}
            >
              Confirm Deactivation
            </button>

          </div>
        </Modal>
      )}

    </div>
  );
}
