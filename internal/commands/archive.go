package commands

import (
	"fmt"

	"github.com/inceptyon-labs/totem/pkg/bean"
	"github.com/inceptyon-labs/totem/internal/output"
	"github.com/spf13/cobra"
)

var archiveJSON bool

var archiveCmd = &cobra.Command{
	Use:   "archive",
	Short: "Move completed/scrapped totems to the archive",
	Long: `Moves all totems with status "completed" or "scrapped" to the archive directory (.totem/archive/).
Archived totems are preserved for project memory and remain visible in all queries.
The archive keeps the main .totem directory tidy while preserving project history.

Relationships (parent, blocking) are preserved in archived totems.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		allBeans := core.All()

		// Find beans with any archive status
		var archiveBeans []*bean.Bean
		archiveSet := make(map[string]bool)
		for _, b := range allBeans {
			if cfg.IsArchiveStatus(b.Status) {
				archiveBeans = append(archiveBeans, b)
				archiveSet[b.ID] = true
			}
		}

		if len(archiveBeans) == 0 {
			if archiveJSON {
				return output.SuccessMessage("No totems to archive")
			}
			fmt.Println("No totems with archive status to archive.")
			return nil
		}

		// Sort beans for consistent display
		bean.SortByStatusPriorityAndType(archiveBeans, cfg.StatusNames(), cfg.PriorityNames(), cfg.TypeNames())

		// Archive all beans with archive status
		var archived []string
		for _, b := range archiveBeans {
			if err := core.Archive(b.ID); err != nil {
				if archiveJSON {
					return output.Error(output.ErrFileError, fmt.Sprintf("failed to archive totem %s: %s", b.ID, err.Error()))
				}
				return fmt.Errorf("failed to archive totem %s: %w", b.ID, err)
			}
			archived = append(archived, b.ID)
		}

		if archiveJSON {
			return output.SuccessMessage(fmt.Sprintf("Archived %d totem(s) to .totem/archive/", len(archived)))
		}

		fmt.Printf("Archived %d totem(s) to .totem/archive/\n", len(archived))
		return nil
	},
}

func RegisterArchiveCmd(root *cobra.Command) {
	archiveCmd.Flags().BoolVar(&archiveJSON, "json", false, "Output as JSON")
	root.AddCommand(archiveCmd)
}
