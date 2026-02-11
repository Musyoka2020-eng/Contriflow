// Reports Manager Module
// Handles all report generation, display, and export functionality

// Show toast notification
function showToast(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
}

const ReportsManager = (function() {
    let currentReportData = null;

    return {
        // Get current report data
        getCurrentReportData() {
            return currentReportData;
        },

        // Populate report filters
        populateReportFilters(reportStartMonth, reportEndMonth, reportStartYear, reportEndYear, currentMonth, currentYear, contributionsData) {
            const months = moment.months();
            const currentYearNum = parseInt(moment().format('YYYY'));

            [reportStartMonth, reportEndMonth].forEach(select => {
                select.innerHTML = '';
                months.forEach((month, index) => {
                    const option = document.createElement('option');
                    option.value = month;
                    option.textContent = month;
                    if (index === 0) option.selected = true;
                    select.appendChild(option);
                });
            });

            reportEndMonth.value = currentMonth;

            [reportStartYear, reportEndYear].forEach(select => {
                Utils.populateYearSelector(select, contributionsData, currentYearNum);
            });
        },

        // Update member select dropdown
        updateMemberSelect(contributionsData, reportMemberSelect) {
            const allMembers = new Set();

            for (const year in contributionsData) {
                if (!contributionsData.hasOwnProperty(year)) continue;
                for (const month in contributionsData[year]) {
                    if (!contributionsData[year].hasOwnProperty(month)) continue;
                    const monthData = contributionsData[year][month];
                    if (monthData.contributions) {
                        monthData.contributions.forEach(c => {
                            if (c.name) allMembers.add(c.name);
                        });
                    }
                }
            }

            const sortedMembers = Array.from(allMembers).sort();

            reportMemberSelect.innerHTML = '<option value="">-- Select Member --</option>';
            sortedMembers.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                reportMemberSelect.appendChild(option);
            });
        },

        // Handle report type change
        handleReportTypeChange(reportTypeSelect, memberSelectGroup, statusFilterGroup) {
            const reportType = reportTypeSelect.value;
            memberSelectGroup.style.display = (reportType === 'individual') ? 'block' : 'none';
            
            // Show status filter only for individual reports
            if (statusFilterGroup) {
                statusFilterGroup.style.display = (reportType === 'individual') ? 'block' : 'none';
            }
        },

        // Check if data exists in the selected date range
        hasDataInRange(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                if (contributionsData[year]?.[month]?.contributions && 
                    contributionsData[year][month].contributions.length > 0) {
                    return true;
                }

                currentDate.add(1, 'month');
            }

            return false;
        },

        // Generate report based on type
        generateReport(reportTypeSelect, reportMemberSelect, reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData, statusFilter = 'all') {
            const reportType = reportTypeSelect.value;

            try {
                // Check if data exists in the selected range first
                if (!this.hasDataInRange(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData)) {
                    throw new Error(`No data available for the selected date range (${reportStartMonth.value} ${reportStartYear.value} to ${reportEndMonth.value} ${reportEndYear.value})`);
                }

                let reportData = null;

                switch (reportType) {
                    case 'individual':
                        reportData = this.generateIndividualReport(reportMemberSelect, reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData, statusFilter);
                        break;
                    case 'all-members':
                        reportData = this.generateAllMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData);
                        break;
                    case 'expected-members':
                        reportData = this.generateExpectedMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData);
                        break;
                    case 'month-range':
                        reportData = this.generateMonthRangeReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData);
                        break;
                    default:
                        throw new Error('Invalid report type');
                }

                if (reportData) {
                    return reportData;
                }
            } catch (error) {
                console.error('Error generating report:', error);
                showToast('error', 'Report Generation Error', error.message || 'Failed to generate report');
                return null;
            }
        },

        // Generate individual member report
        generateIndividualReport(reportMemberSelect, reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData, statusFilter = 'all') {
            const memberName = reportMemberSelect.value;

            if (!memberName) {
                throw new Error('Please select a member');
            }

            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const memberData = [];
            let totalPaid = 0;
            let totalUnpaid = 0;
            let totalAmount = 0;
            let monthsWithContribution = 0;
            let totalMonthsInRange = 0;

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');
                totalMonthsInRange++;

                if (contributionsData[year]?.[month]?.contributions) {
                    const contribution = contributionsData[year][month].contributions.find(
                        c => c.name === memberName
                    );

                    if (contribution) {
                        const rowData = {
                            month,
                            year,
                            amount: contribution.amount,
                            paid: contribution.paid,
                            noRecord: false
                        };

                        // Apply status filter for display
                        const shouldDisplay = statusFilter === 'all' || 
                            (statusFilter === 'paid' && contribution.paid) ||
                            (statusFilter === 'unpaid' && !contribution.paid);
                        
                        if (shouldDisplay) {
                            memberData.push(rowData);
                            
                            // Only count in summary if displayed
                            totalAmount += contribution.amount;
                            monthsWithContribution++;
                            if (contribution.paid) {
                                totalPaid += contribution.amount;
                            } else {
                                totalUnpaid += contribution.amount;
                            }
                        }
                    } else {
                        const rowData = {
                            month,
                            year,
                            amount: 0,
                            paid: false,
                            noRecord: true
                        };

                        // Apply status filter
                        if (statusFilter === 'all' || statusFilter === 'no-record') {
                            memberData.push(rowData);
                        }
                    }
                } else {
                    const rowData = {
                        month,
                        year,
                        amount: 0,
                        paid: false,
                        noRecord: true
                    };

                    // Apply status filter
                    if (statusFilter === 'all' || statusFilter === 'no-record') {
                        memberData.push(rowData);
                    }
                }

                currentDate.add(1, 'month');
            }

            return {
                type: 'individual',
                title: `Contribution Report: ${memberName}`,
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}${statusFilter !== 'all' ? ` (${statusFilter.replace('-', ' ')})` : ''}`,
                data: memberData,
                summary: {
                    totalAmount,
                    totalPaid,
                    totalUnpaid,
                    monthsContributed: monthsWithContribution,
                    totalMonths: totalMonthsInRange
                },
                memberName,
                statusFilter
            };
        },

        // Generate all members report
        generateAllMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const membersMap = new Map();

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                if (contributionsData[year]?.[month]?.contributions) {
                    contributionsData[year][month].contributions.forEach(contribution => {
                        if (!membersMap.has(contribution.name)) {
                            membersMap.set(contribution.name, {
                                name: contribution.name,
                                totalAmount: 0,
                                totalPaid: 0,
                                totalUnpaid: 0,
                                monthsContributed: 0,
                                monthsOutstanding: 0
                            });
                        }

                        const memberData = membersMap.get(contribution.name);
                        memberData.totalAmount += contribution.amount;
                        memberData.monthsContributed++;

                        if (contribution.paid) {
                            memberData.totalPaid += contribution.amount;
                        } else {
                            memberData.totalUnpaid += contribution.amount;
                            memberData.monthsOutstanding++;
                        }
                    });
                }

                currentDate.add(1, 'month');
            }

            const membersArray = Array.from(membersMap.values()).sort((a, b) =>
                a.name.localeCompare(b.name)
            );

            const totalMonthsInRange = endDate.diff(startDate, 'months') + 1;

            return {
                type: 'all-members',
                title: 'All Members Contribution Status',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: membersArray,
                summary: {
                    totalMembers: membersArray.length,
                    totalMonthsInRange,
                    grandTotalAmount: membersArray.reduce((sum, m) => sum + m.totalAmount, 0),
                    grandTotalPaid: membersArray.reduce((sum, m) => sum + m.totalPaid, 0),
                    grandTotalUnpaid: membersArray.reduce((sum, m) => sum + m.totalUnpaid, 0)
                }
            };
        },

        // Generate non-contributors report
        generateNonContributorsReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const membersMap = new Map();

            // Collect all members
            for (const year in contributionsData) {
                if (!contributionsData.hasOwnProperty(year)) continue;
                for (const month in contributionsData[year]) {
                    if (!contributionsData[year].hasOwnProperty(month)) continue;
                    const monthData = contributionsData[year][month];
                    if (monthData.contributions) {
                        monthData.contributions.forEach(c => {
                            if (!membersMap.has(c.name)) {
                                membersMap.set(c.name, {
                                    name: c.name,
                                    lastContributionMonth: null,
                                    lastContributionYear: null,
                                    monthsMissed: 0,
                                    totalOwed: 0
                                });
                            }
                        });
                    }
                }
            }

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                const contributorsThisMonth = new Set();

                if (contributionsData[year]?.[month]?.contributions) {
                    contributionsData[year][month].contributions.forEach(contribution => {
                        contributorsThisMonth.add(contribution.name);

                        const memberData = membersMap.get(contribution.name);
                        if (memberData && contribution.paid) {
                            memberData.lastContributionMonth = month;
                            memberData.lastContributionYear = year;
                        }
                    });
                }

                membersMap.forEach((memberData, name) => {
                    if (!contributorsThisMonth.has(name)) {
                        memberData.monthsMissed++;

                        let expectedAmount = 0;
                        for (const y in contributionsData) {
                            if (contributionsData[y]?.[month]?.contributions) {
                                const prevContribution = contributionsData[y][month].contributions.find(
                                    c => c.name === name
                                );
                                if (prevContribution) {
                                    expectedAmount = prevContribution.amount;
                                    break;
                                }
                            }
                        }
                        memberData.totalOwed += expectedAmount;
                    }
                });

                currentDate.add(1, 'month');
            }

            const nonContributors = Array.from(membersMap.values())
                .filter(m => m.monthsMissed > 0)
                .sort((a, b) => b.monthsMissed - a.monthsMissed);

            return {
                type: 'non-contributors',
                title: 'Non-Contributing Members Report',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: nonContributors,
                summary: {
                    totalNonContributors: nonContributors.length,
                    totalMonthsMissed: nonContributors.reduce((sum, m) => sum + m.monthsMissed, 0),
                    totalOwed: nonContributors.reduce((sum, m) => sum + m.totalOwed, 0)
                }
            };
        },

        // Generate new members report
        generateNewMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const newMembers = [];
            const seenMembers = new Set();

            // Mark members before start date
            for (const year in contributionsData) {
                if (!contributionsData.hasOwnProperty(year)) continue;

                const yearNum = parseInt(year);
                const startYearNum = parseInt(startYear);

                for (const month in contributionsData[year]) {
                    if (!contributionsData[year].hasOwnProperty(month)) continue;

                    const monthIndex = months.indexOf(month);
                    const startMonthIndex = months.indexOf(startMonth);

                    const isBeforeStart = yearNum < startYearNum ||
                        (yearNum === startYearNum && monthIndex < startMonthIndex);

                    if (isBeforeStart && contributionsData[year][month].contributions) {
                        contributionsData[year][month].contributions.forEach(c => {
                            seenMembers.add(c.name);
                        });
                    }
                }
            }

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                if (contributionsData[year]?.[month]?.contributions) {
                    contributionsData[year][month].contributions.forEach(contribution => {
                        if (!seenMembers.has(contribution.name)) {
                            newMembers.push({
                                name: contribution.name,
                                joinMonth: month,
                                joinYear: year,
                                firstAmount: contribution.amount,
                                firstPaid: contribution.paid
                            });
                            seenMembers.add(contribution.name);
                        }
                    });
                }

                currentDate.add(1, 'month');
            }

            return {
                type: 'new-members',
                title: 'New Members Report',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: newMembers,
                summary: {
                    totalNewMembers: newMembers.length
                }
            };
        },

        // Generate expected members report
        generateExpectedMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            // Get expected members list from localStorage
            const expectedMembers = JSON.parse(localStorage.getItem('expectedMembers') || '[]');
            
            if (expectedMembers.length === 0) {
                throw new Error('No expected members list configured. Please add members to the expected list first.');
            }

            // Parse date range
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            const memberStats = expectedMembers.map(memberEntry => {
                // Handle both old format (string) and new format (object)
                const memberName = typeof memberEntry === 'string' ? memberEntry : memberEntry.name;
                const monthlyExpectedAmount = typeof memberEntry === 'string' ? 0 : memberEntry.monthlyAmount;
                
                let neverContributed = true;
                let totalOwed = 0;
                let monthsMissed = 0;
                let totalMonths = 0;
                let totalExpectedAmount = 0;

                // Check all years and months in contributionsData within the date range
                for (const year in contributionsData) {
                    for (const month in contributionsData[year]) {
                        const monthData = contributionsData[year][month];
                        
                        // Check if this month is within the date range
                        const currentMonthDate = moment(`${year}-${months.indexOf(month) + 1}`, 'YYYY-M');
                        if (currentMonthDate.isBefore(startDate, 'month') || currentMonthDate.isAfter(endDate, 'month')) {
                            continue; // Skip months outside the date range
                        }
                        
                        if (monthData.contributions) {
                            totalMonths++;
                            // Use the member's monthly expected amount, or fall back to month's default amount
                            const expectedAmount = monthlyExpectedAmount || monthData.amount || 0;
                            totalExpectedAmount += expectedAmount;
                            
                            const contribution = monthData.contributions.find(c => c.name === memberName);
                            
                            if (contribution) {
                                // Member has at least one contribution
                                neverContributed = false;
                                
                                if (!contribution.paid) {
                                    totalOwed += contribution.amount;
                                    monthsMissed++;
                                }
                            } else {
                                // No record for this month - they owe the expected amount
                                totalOwed += expectedAmount;
                                monthsMissed++;
                            }
                        }
                    }
                }

                return {
                    name: memberName,
                    monthlyExpectedAmount,
                    neverContributed,
                    totalOwed,
                    monthsMissed,
                    totalMonths,
                    totalExpectedAmount
                };
            });

            return {
                type: 'expected-members',
                title: 'Expected Members List',
                subtitle: 'Members expected to contribute and their status',
                data: memberStats,
                summary: {
                    totalExpected: expectedMembers.length,
                    neverContributed: memberStats.filter(m => m.neverContributed).length,
                    totalOwed: memberStats.reduce((sum, m) => sum + m.totalOwed, 0),
                    totalExpectedAmount: memberStats.reduce((sum, m) => sum + m.totalExpectedAmount, 0)
                }
            };
        },

        // Generate month range report
        generateMonthRangeReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const monthlyData = [];

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();
            let grandTotal = 0;
            let grandPaid = 0;
            let grandUnpaid = 0;

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                let monthTotal = 0;
                let monthPaid = 0;
                let monthUnpaid = 0;
                let contributors = 0;

                if (contributionsData[year]?.[month]?.contributions) {
                    const monthData = contributionsData[year][month];
                    contributors = monthData.contributions.length;

                    monthData.contributions.forEach(c => {
                        monthTotal += c.amount;
                        if (c.paid) {
                            monthPaid += c.amount;
                        } else {
                            monthUnpaid += c.amount;
                        }
                    });
                }

                monthlyData.push({
                    month,
                    year,
                    total: monthTotal,
                    paid: monthPaid,
                    unpaid: monthUnpaid,
                    contributors
                });

                grandTotal += monthTotal;
                grandPaid += monthPaid;
                grandUnpaid += monthUnpaid;

                currentDate.add(1, 'month');
            }

            return {
                type: 'month-range',
                title: 'Month Range Summary',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: monthlyData,
                summary: {
                    totalMonths: monthlyData.length,
                    grandTotal,
                    grandPaid,
                    grandUnpaid
                }
            };
        },

        // Display report in UI
        displayReport(reportData, reportTitle, reportContent, reportOutput) {
            currentReportData = reportData;
            window.currentReportData = reportData; // For export functions

            reportTitle.textContent = reportData.title;

            let html = `<div class="report-subtitle">${reportData.subtitle}</div>`;

            switch (reportData.type) {
                case 'individual':
                    html += this.generateIndividualReportHTML(reportData);
                    break;
                case 'all-members':
                    html += this.generateAllMembersReportHTML(reportData);
                    break;
                case 'expected-members':
                    html += this.generateExpectedMembersReportHTML(reportData);
                    break;
                case 'month-range':
                    html += this.generateMonthRangeReportHTML(reportData);
                    break;
            }

            reportContent.innerHTML = html;
            reportOutput.style.display = 'block';
            reportOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },

        // Generate HTML for individual report
        generateIndividualReportHTML(reportData) {
            let html = '<table class="report-table"><thead><tr>';
            html += '<th>Month</th><th>Year</th><th>Amount</th><th>Status</th>';
            html += '</tr></thead><tbody>';

            reportData.data.forEach(row => {
                const statusClass = row.noRecord ? 'no-record' : (row.paid ? 'paid' : 'unpaid');
                const statusText = row.noRecord ? 'No Record' : (row.paid ? 'Paid' : 'Unpaid');
                const icon = row.noRecord ? '⚠️' : (row.paid ? '✅' : '❌');

                html += `<tr class="${statusClass}">`;
                html += `<td>${row.month}</td>`;
                html += `<td>${row.year}</td>`;
                html += `<td>${row.amount.toLocaleString()}/=</td>`;
                html += `<td>${icon} ${statusText}</td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';

            // Improved summary section with better layout
            html += `
                <div class="report-summary">
                    <h4><i class="fas fa-chart-bar"></i> Summary</h4>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <div class="summary-label">Total Months in Range</div>
                            <div class="summary-value">${reportData.summary.totalMonths}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Months with Contributions</div>
                            <div class="summary-value" style="color: var(--accent-green);">${reportData.summary.monthsContributed}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Amount</div>
                            <div class="summary-value">${reportData.summary.totalAmount.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Paid</div>
                            <div class="summary-value accent-paid">${reportData.summary.totalPaid.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Unpaid</div>
                            <div class="summary-value accent-unpaid">${reportData.summary.totalUnpaid.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Payment Rate</div>
                            <div class="summary-value" style="color: var(--primary-color);">${reportData.summary.totalAmount > 0 ? Math.round((reportData.summary.totalPaid / reportData.summary.totalAmount) * 100) : 0}%</div>
                        </div>
                    </div>
                </div>
            `;

            return html;
        },

        // Generate HTML for all members report
        generateAllMembersReportHTML(reportData) {
            let html = '<table class="report-table"><thead><tr>';
            html += '<th>Member Name</th><th>Months</th><th>Total</th><th>Paid</th><th>Unpaid</th><th>Outstanding</th>';
            html += '</tr></thead><tbody>';

            reportData.data.forEach(member => {
                html += '<tr>';
                html += `<td><strong>${Utils.sanitizeHTML(member.name)}</strong></td>`;
                html += `<td>${member.monthsContributed}</td>`;
                html += `<td>${member.totalAmount.toLocaleString()}/=</td>`;
                html += `<td class="paid">${member.totalPaid.toLocaleString()}/=</td>`;
                html += `<td class="unpaid">${member.totalUnpaid.toLocaleString()}/=</td>`;
                html += `<td>${member.monthsOutstanding}</td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';

            // Improved summary section with better layout
            html += `
                <div class="report-summary">
                    <h4><i class="fas fa-chart-bar"></i> Summary</h4>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <div class="summary-label">Total Members</div>
                            <div class="summary-value">${reportData.summary.totalMembers}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Months in Range</div>
                            <div class="summary-value">${reportData.summary.totalMonthsInRange}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Grand Total</div>
                            <div class="summary-value">${reportData.summary.grandTotalAmount.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Paid</div>
                            <div class="summary-value accent-paid">${reportData.summary.grandTotalPaid.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Unpaid</div>
                            <div class="summary-value accent-unpaid">${reportData.summary.grandTotalUnpaid.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Payment Rate</div>
                            <div class="summary-value" style="color: var(--primary-color);">${reportData.summary.grandTotalAmount > 0 ? Math.round((reportData.summary.grandTotalPaid / reportData.summary.grandTotalAmount) * 100) : 0}%</div>
                        </div>
                    </div>
                </div>
            `;

            return html;
        },

        // Generate HTML for expected members report
        generateExpectedMembersReportHTML(reportData) {
            let html = '<table class="report-table"><thead><tr>';
            html += '<th>Member Name</th><th>Monthly Expected</th><th>Status</th><th>Total Months</th><th>Months Missed</th><th>Total Expected</th><th>Total Owed</th>';
            html += '</tr></thead><tbody>';

            reportData.data.forEach(member => {
                const neverContributedIcon = member.neverContributed ? '❌' : '✅';
                const neverContributedText = member.neverContributed ? 'Never Contributed' : 'Has Contributed';
                const rowClass = member.neverContributed ? 'unpaid' : '';

                html += `<tr class="${rowClass}">`;
                html += `<td><strong>${Utils.sanitizeHTML(member.name)}</strong></td>`;
                html += `<td>${member.monthlyExpectedAmount.toLocaleString()}/=</td>`;
                html += `<td>${neverContributedIcon} ${neverContributedText}</td>`;
                html += `<td>${member.totalMonths}</td>`;
                html += `<td class="unpaid">${member.monthsMissed}</td>`;
                html += `<td>${member.totalExpectedAmount.toLocaleString()}/=</td>`;
                html += `<td class="unpaid">${member.totalOwed.toLocaleString()}/=</td>`;
                html += '</tr>';
            });

            if (reportData.data.length === 0) {
                html += '<tr><td colspan="7" style="text-align: center;">No expected members configured</td></tr>';
            }

            html += '</tbody></table>';

            // Improved summary section with better layout
            html += `
                <div class="report-summary">
                    <h4><i class="fas fa-chart-bar"></i> Summary</h4>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <div class="summary-label">Total Expected Members</div>
                            <div class="summary-value">${reportData.summary.totalExpected}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Never Contributed</div>
                            <div class="summary-value accent-unpaid">${reportData.summary.neverContributed}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Expected Amount</div>
                            <div class="summary-value">${reportData.summary.totalExpectedAmount.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Owed</div>
                            <div class="summary-value accent-unpaid">${reportData.summary.totalOwed.toLocaleString()}/=</div>
                        </div>
                    </div>
                </div>
            `;

            return html;
        },

        // Generate HTML for non-contributors report
        generateNonContributorsReportHTML(reportData) {
            let html = '<table class="report-table"><thead><tr>';
            html += '<th>Member Name</th><th>Months Missed</th><th>Last Contribution</th><th>Amount Owed</th>';
            html += '</tr></thead><tbody>';

            reportData.data.forEach(member => {
                const lastContribution = member.lastContributionMonth
                    ? `${member.lastContributionMonth} ${member.lastContributionYear}`
                    : 'Never';

                html += '<tr>';
                html += `<td><strong>${Utils.sanitizeHTML(member.name)}</strong></td>`;
                html += `<td class="unpaid">${member.monthsMissed}</td>`;
                html += `<td>${lastContribution}</td>`;
                html += `<td class="unpaid">${member.totalOwed.toLocaleString()}/=</td>`;
                html += '</tr>';
            });

            if (reportData.data.length === 0) {
                html += '<tr><td colspan="4" style="text-align: center;">No non-contributing members found</td></tr>';
            }

            html += '</tbody></table>';

            html += '<div class="report-summary">';
            html += '<h4>Summary</h4>';
            html += `<p><strong>Total Non-Contributors:</strong> ${reportData.summary.totalNonContributors}</p>`;
            html += `<p><strong>Total Months Missed:</strong> ${reportData.summary.totalMonthsMissed}</p>`;
            html += `<p class="unpaid"><strong>Total Amount Owed:</strong> ${reportData.summary.totalOwed.toLocaleString()}/=</p>`;
            html += '</div>';

            return html;
        },

        // Generate HTML for new members report
        generateNewMembersReportHTML(reportData) {
            let html = '<table class="report-table"><thead><tr>';
            html += '<th>Member Name</th><th>Join Date</th><th>First Amount</th><th>First Payment Status</th>';
            html += '</tr></thead><tbody>';

            reportData.data.forEach(member => {
                const statusIcon = member.firstPaid ? '✅' : '❌';
                const statusText = member.firstPaid ? 'Paid' : 'Unpaid';
                const statusClass = member.firstPaid ? 'paid' : 'unpaid';

                html += '<tr>';
                html += `<td><strong>${Utils.sanitizeHTML(member.name)}</strong></td>`;
                html += `<td>${member.joinMonth} ${member.joinYear}</td>`;
                html += `<td>${member.firstAmount.toLocaleString()}/=</td>`;
                html += `<td class="${statusClass}">${statusIcon} ${statusText}</td>`;
                html += '</tr>';
            });

            if (reportData.data.length === 0) {
                html += '<tr><td colspan="4" style="text-align: center;">No new members found in this period</td></tr>';
            }

            html += '</tbody></table>';

            html += '<div class="report-summary">';
            html += '<h4>Summary</h4>';
            html += `<p><strong>Total New Members:</strong> ${reportData.summary.totalNewMembers}</p>`;
            html += '</div>';

            return html;
        },

        // Generate HTML for month range report
        generateMonthRangeReportHTML(reportData) {
            let html = '<table class="report-table"><thead><tr>';
            html += '<th>Month</th><th>Year</th><th>Contributors</th><th>Total</th><th>Paid</th><th>Unpaid</th>';
            html += '</tr></thead><tbody>';

            reportData.data.forEach(row => {
                html += '<tr>';
                html += `<td><strong>${row.month}</strong></td>`;
                html += `<td>${row.year}</td>`;
                html += `<td>${row.contributors}</td>`;
                html += `<td>${row.total.toLocaleString()}/=</td>`;
                html += `<td class="paid">${row.paid.toLocaleString()}/=</td>`;
                html += `<td class="unpaid">${row.unpaid.toLocaleString()}/=</td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';

            // Improved summary section with better layout
            html += `
                <div class="report-summary">
                    <h4><i class="fas fa-chart-bar"></i> Summary</h4>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <div class="summary-label">Total Months</div>
                            <div class="summary-value">${reportData.summary.totalMonths}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Grand Total</div>
                            <div class="summary-value">${reportData.summary.grandTotal.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Paid</div>
                            <div class="summary-value accent-paid">${reportData.summary.grandPaid.toLocaleString()}/=</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Unpaid</div>
                            <div class="summary-value accent-unpaid">${reportData.summary.grandUnpaid.toLocaleString()}/=</div>
                        </div>
                    </div>
                </div>
            `;

            return html;
        },

        // Export report as text
        exportReportAsText() {
            if (!currentReportData) {
                showToast('warning', 'No Report', 'Please generate a report first');
                return;
            }

            const reportData = currentReportData;
            let text = `${reportData.title}\n`;
            text += `${reportData.subtitle}\n`;
            text += '='.repeat(50) + '\n\n';

            switch (reportData.type) {
                case 'individual':
                    text += this.generateIndividualReportText(reportData);
                    break;
                case 'all-members':
                    text += this.generateAllMembersReportText(reportData);
                    break;
                case 'expected-members':
                    text += this.generateExpectedMembersReportText(reportData);
                    break;
                case 'month-range':
                    text += this.generateMonthRangeReportText(reportData);
                    break;
            }

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.txt`;
            link.click();
            URL.revokeObjectURL(url);

            showToast('success', 'Report Exported', 'Report has been downloaded as text file');
        },

        // Generate text versions of reports
        generateIndividualReportText(reportData) {
            let text = '';
            reportData.data.forEach(row => {
                const status = row.noRecord ? 'No Record' : (row.paid ? 'Paid' : 'Unpaid');
                text += `${row.month} ${row.year} - ${row.amount}/= - ${status}\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Months: ${reportData.summary.totalMonths}\n`;
            text += `Months with Contributions: ${reportData.summary.monthsContributed}\n`;
            text += `Total Amount: ${reportData.summary.totalAmount.toLocaleString()}/=\n`;
            text += `Total Paid: ${reportData.summary.totalPaid.toLocaleString()}/=\n`;
            text += `Total Unpaid: ${reportData.summary.totalUnpaid.toLocaleString()}/=\n`;
            return text;
        },

        generateAllMembersReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                text += `${member.name}\n`;
                text += `  Months: ${member.monthsContributed}\n`;
                text += `  Total: ${member.totalAmount.toLocaleString()}/=\n`;
                text += `  Paid: ${member.totalPaid.toLocaleString()}/=\n`;
                text += `  Unpaid: ${member.totalUnpaid.toLocaleString()}/=\n`;
                text += `  Outstanding Months: ${member.monthsOutstanding}\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Members: ${reportData.summary.totalMembers}\n`;
            text += `Grand Total: ${reportData.summary.grandTotalAmount.toLocaleString()}/=\n`;
            text += `Total Paid: ${reportData.summary.grandTotalPaid.toLocaleString()}/=\n`;
            text += `Total Unpaid: ${reportData.summary.grandTotalUnpaid.toLocaleString()}/=\n`;
            return text;
        },

        generateExpectedMembersReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                const neverContributed = member.neverContributed ? 'Never Contributed' : 'Has Contributed';
                text += `${member.name}\n`;
                text += `  Monthly Expected: ${member.monthlyExpectedAmount.toLocaleString()}/=\n`;
                text += `  Status: ${neverContributed}\n`;
                text += `  Total Months: ${member.totalMonths}\n`;
                text += `  Months Missed: ${member.monthsMissed}\n`;
                text += `  Total Expected Amount: ${member.totalExpectedAmount.toLocaleString()}/=\n`;
                text += `  Total Owed: ${member.totalOwed.toLocaleString()}/=\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Expected Members: ${reportData.summary.totalExpected}\n`;
            text += `Never Contributed: ${reportData.summary.neverContributed}\n`;
            text += `Total Expected Amount: ${reportData.summary.totalExpectedAmount.toLocaleString()}/=\n`;
            text += `Total Owed: ${reportData.summary.totalOwed.toLocaleString()}/=\n`;
            return text;
        },

        generateNonContributorsReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                const lastContribution = member.lastContributionMonth
                    ? `${member.lastContributionMonth} ${member.lastContributionYear}`
                    : 'Never';
                text += `${member.name}\n`;
                text += `  Months Missed: ${member.monthsMissed}\n`;
                text += `  Last Contribution: ${lastContribution}\n`;
                text += `  Amount Owed: ${member.totalOwed.toLocaleString()}/=\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Non-Contributors: ${reportData.summary.totalNonContributors}\n`;
            text += `Total Months Missed: ${reportData.summary.totalMonthsMissed}\n`;
            text += `Total Amount Owed: ${reportData.summary.totalOwed.toLocaleString()}/=\n`;
            return text;
        },

        generateNewMembersReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                const status = member.firstPaid ? 'Paid' : 'Unpaid';
                text += `${member.name}\n`;
                text += `  Joined: ${member.joinMonth} ${member.joinYear}\n`;
                text += `  First Amount: ${member.firstAmount.toLocaleString()}/=\n`;
                text += `  First Payment: ${status}\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total New Members: ${reportData.summary.totalNewMembers}\n`;
            return text;
        },

        generateMonthRangeReportText(reportData) {
            let text = '';
            reportData.data.forEach(row => {
                text += `${row.month} ${row.year}\n`;
                text += `  Contributors: ${row.contributors}\n`;
                text += `  Total: ${row.total.toLocaleString()}/=\n`;
                text += `  Paid: ${row.paid.toLocaleString()}/=\n`;
                text += `  Unpaid: ${row.unpaid.toLocaleString()}/=\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Months: ${reportData.summary.totalMonths}\n`;
            text += `Grand Total: ${reportData.summary.grandTotal.toLocaleString()}/=\n`;
            text += `Total Paid: ${reportData.summary.grandPaid.toLocaleString()}/=\n`;
            text += `Total Unpaid: ${reportData.summary.grandUnpaid.toLocaleString()}/=\n`;
            return text;
        },

        // Print report
        printReportContent(reportContent) {
            if (!currentReportData) {
                showToast('warning', 'No Report', 'Please generate a report first');
                return;
            }

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #4a69bd; }
                        .subtitle { color: #666; margin-bottom: 20px; }
                        .report-subtitle { font-size: 15px; color: #666; margin-bottom: 16px; padding: 12px 16px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #4a69bd; color: white; }
                        .paid { color: green; }
                        .unpaid { color: red; }
                        .no-record { color: orange; }
                        .summary { margin-top: 20px; padding: 15px; background-color: #f5f5f5; }
                        .report-summary { margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 8px; }
                        @media print {
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <h1>${currentReportData.title}</h1>
                    ${reportContent.innerHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        },

        // Share report via WhatsApp
        shareReportViaWhatsapp(phoneNumber) {
            if (!currentReportData) {
                showToast('warning', 'No Report', 'Please generate a report first');
                return;
            }

            if (!phoneNumber) {
                showToast('warning', 'No Phone Number', 'Please save your phone number in the settings first');
                return;
            }

            const reportData = currentReportData;
            let message = `*${reportData.title}*\n`;
            message += `${reportData.subtitle}\n`;
            message += '--'.repeat(25) + '\n\n';

            switch (reportData.type) {
                case 'individual':
                    message += this.generateIndividualReportText(reportData);
                    break;
                case 'all-members':
                    message += `Total Members: ${reportData.summary.totalMembers}\n`;
                    message += `Grand Total: ${reportData.summary.grandTotalAmount.toLocaleString()}/=\n`;
                    message += `Total Paid: ${reportData.summary.grandTotalPaid.toLocaleString()}/=\n`;
                    message += `Total Unpaid: ${reportData.summary.grandTotalUnpaid.toLocaleString()}/=\n`;
                    break;
                case 'expected-members':
                    message += this.generateExpectedMembersReportText(reportData);
                    break;
                case 'month-range':
                    message += this.generateMonthRangeReportText(reportData);
                    break;
            }

            message += '\n_Generated from Contribution Manager_';

            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }
    };
})();
