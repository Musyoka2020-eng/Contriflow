// Contribution Renderer Module
// Pure render functions for monthly, yearly, and blacklist views
// All methods accept data as parameters — no direct state coupling

const ContributionRenderer = (function() {
    return {
        // Render monthly contributions view
        renderMonthlyView(contributionsData, currentYear, currentMonth, eventHandlers) {
            const dom = DOMManager.getMonthlyViewElements();

            // Safety checks for DOM elements
            if (!dom.contributionsList || !dom.currentMonthDisplay || !dom.currentYearDisplay) {
                return;
            }

            const currentData = contributionsData[currentYear]?.[currentMonth] || { contributions: [], total: 0 };

            dom.currentMonthDisplay.textContent = currentMonth;
            dom.currentYearDisplay.textContent = currentYear;

            // If no contributions, show empty state
            if (!currentData.contributions || currentData.contributions.length === 0) {
                // Get the contributions section to hide it
                const dom2 = DOMManager.getAll();
                const contributionsSection = dom2.monthlyView?.querySelector('.contributions');
                const emptyStateContainer = dom2.monthlyView?.querySelector('[data-empty-month-state]');

                // Hide the contributions section
                if (contributionsSection) contributionsSection.style.display = 'none';

                // Remove the clone button when no data
                const cloneBtn = document.getElementById('clone-month-btn');
                if (cloneBtn) cloneBtn.remove();

                // Create or show empty state
                if (!emptyStateContainer) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.setAttribute('data-empty-month-state', 'true');
                    emptyDiv.innerHTML = Templates.EMPTY_MONTH_STATE;
                    dom2.monthlyView?.appendChild(emptyDiv);

                    // Attach event listener to the button
                    const addBtn = emptyDiv.querySelector('#add-contribution-empty-state');
                    if (addBtn) {
                        addBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            const mainAddBtn = document.querySelector('#add-contribution-btn');
                            if (mainAddBtn) mainAddBtn.click();
                        });
                    }
                } else {
                    emptyStateContainer.style.display = '';
                }
                return;
            }

            // Show the contributions section when there's data
            const dom3 = DOMManager.getAll();
            const contributionsSection = dom3.monthlyView?.querySelector('.contributions');
            const emptyStateContainer = dom3.monthlyView?.querySelector('[data-empty-month-state]');
            if (contributionsSection) contributionsSection.style.display = '';
            if (emptyStateContainer) emptyStateContainer.style.display = 'none';

            // Show the clone button when there's data (UIRenderer owns this since it uses state)
            UIRenderer.addCloneMonthButton();

            // Render contributions normally
            dom.contributionsList.innerHTML = '';
            if (Array.isArray(currentData.contributions)) {
                currentData.contributions.forEach((item, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = Templates.MONTHLY_CONTRIBUTION_ROW(item, index);
                    dom.contributionsList.appendChild(row);
                });
            }

            // Attach event listeners
            if (eventHandlers) {
                dom.contributionsList.querySelectorAll('.toggle-payment').forEach(btn => {
                    btn.addEventListener('click', eventHandlers.togglePaymentStatus);
                });

                dom.contributionsList.querySelectorAll('.remove-contribution').forEach(btn => {
                    btn.addEventListener('click', eventHandlers.removeContribution);
                });

                dom.contributionsList.querySelectorAll('.blacklist-member').forEach(btn => {
                    btn.addEventListener('click', eventHandlers.handleBlacklistMember);
                });

                dom.contributionsList.querySelectorAll('.edit-contribution').forEach(btn => {
                    btn.addEventListener('click', eventHandlers.editContribution);
                });
            }

            // Update totals
            this.updateTotals(contributionsData, currentYear, currentMonth);
        },

        // Update total amount display
        updateTotals(contributionsData, currentYear, currentMonth) {
            const dom = DOMManager.getMonthlyViewElements();

            // Safety checks
            if (!dom.totalAmountPaidDisplay || !dom.totalAmountUnpaidDisplay) {
                return;
            }

            const totals = ContributionsManager.calculateTotals(contributionsData, currentYear, currentMonth);
            dom.totalAmountPaidDisplay.textContent = totals.totalPaid.toLocaleString();
            dom.totalAmountUnpaidDisplay.textContent = totals.totalUnpaid.toLocaleString();
        },

        // Render yearly contributions view
        renderYearlyView(contributionsData, currentYear) {
            const dom = DOMManager.getYearlyViewElements();
            const dom2 = DOMManager.getAll();

            dom.yearlyDisplay.textContent = currentYear;

            const months = moment.months();

            if (!contributionsData[currentYear]) {
                // Hide the contributions section and show empty state
                const contributionsSection = dom2.yearlyView?.querySelector('.contributions');
                const emptyStateContainer = dom2.yearlyView?.querySelector('[data-empty-year-state]');

                if (contributionsSection) contributionsSection.style.display = 'none';

                if (!emptyStateContainer) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.setAttribute('data-empty-year-state', 'true');
                    emptyDiv.innerHTML = Templates.YEARLY_EMPTY_STATE;
                    dom2.yearlyView?.appendChild(emptyDiv);
                } else {
                    emptyStateContainer.style.display = '';
                }
                return;
            }

            // Check if year exists but has no months with contributions
            const yearData = contributionsData[currentYear];
            let hasAnyContributions = false;
            for (const month of months) {
                if (yearData[month] && yearData[month].contributions && yearData[month].contributions.length > 0) {
                    hasAnyContributions = true;
                    break;
                }
            }

            // If year exists but has no contributions, show empty year state
            if (!hasAnyContributions) {
                // Hide the contributions section and show empty state
                const contributionsSection = dom2.yearlyView?.querySelector('.contributions');
                const emptyStateContainer = dom2.yearlyView?.querySelector('[data-empty-year-state]');

                if (contributionsSection) contributionsSection.style.display = 'none';

                if (!emptyStateContainer) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.setAttribute('data-empty-year-state', 'true');
                    emptyDiv.innerHTML = Templates.YEARLY_EMPTY_STATE;
                    dom2.yearlyView?.appendChild(emptyDiv);
                } else {
                    emptyStateContainer.style.display = '';
                }
                return;
            }

            // Show the contributions section when there's data
            const contributionsSection = dom2.yearlyView?.querySelector('.contributions');
            const emptyStateContainer = dom2.yearlyView?.querySelector('[data-empty-year-state]');
            if (contributionsSection) contributionsSection.style.display = '';
            if (emptyStateContainer) emptyStateContainer.style.display = 'none';

            // Clear the yearly list
            dom.yearlyList.innerHTML = '';
            const totals = ContributionsManager.calculateYearlyTotals(contributionsData, currentYear);

            for (const month of months) {
                const monthData = contributionsData[currentYear][month];

                if (monthData) {
                    let paidAmount = 0;
                    let unpaidAmount = 0;

                    for (const item of monthData.contributions) {
                        if (item.paid) {
                            paidAmount += item.amount;
                        } else {
                            unpaidAmount += item.amount;
                        }
                    }

                    const totalMonthAmount = paidAmount + unpaidAmount;
                    const row = document.createElement('tr');
                    row.innerHTML = Templates.YEARLY_MONTH_ROW(month, totalMonthAmount, paidAmount, unpaidAmount);
                    dom.yearlyList.appendChild(row);
                } else {
                    const row = document.createElement('tr');
                    row.innerHTML = Templates.YEARLY_MONTH_ROW(month, 0, 0, 0);
                    dom.yearlyList.appendChild(row);
                }
            }

            const summaryRow = document.createElement('tr');
            summaryRow.classList.add('yearly-summary');
            summaryRow.innerHTML = Templates.YEARLY_SUMMARY_ROW(totals);
            dom.yearlyList.appendChild(summaryRow);

            dom.yearlyTotal.textContent = totals.monthlyTotalPaid;
        },

        // Render blacklist view
        renderBlacklistView(blacklistData, eventHandlers) {
            const dom = DOMManager.getBlacklistViewElements();
            dom.blacklistList.innerHTML = '';

            if (blacklistData.blacklistedMembers.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = Templates.BLACKLIST_EMPTY_STATE;
                dom.blacklistList.appendChild(row);
            } else {
                blacklistData.blacklistedMembers.forEach((name, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = Templates.BLACKLIST_MEMBER_ROW(name, index);
                    dom.blacklistList.appendChild(row);
                });

                // Attach event listeners
                if (eventHandlers && eventHandlers.removeFromBlacklist) {
                    dom.blacklistList.querySelectorAll('.remove-from-blacklist').forEach(btn => {
                        btn.addEventListener('click', eventHandlers.removeFromBlacklist);
                    });
                }
            }
        }
    };
})();
