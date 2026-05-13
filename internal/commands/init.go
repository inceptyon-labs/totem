package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/inceptyon-labs/totem/internal/gitutil"
	"github.com/inceptyon-labs/totem/internal/output"
	"github.com/inceptyon-labs/totem/pkg/beancore"
	"github.com/inceptyon-labs/totem/pkg/config"
)

var initJSON bool

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a totem project",
	Long:  `Creates a .totem directory and .totem.yml config file in the current directory.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		var projectDir string
		var beansDir string
		var dirName string

		if beansPath != "" {
			// Use explicit path for beans directory
			beansDir = beansPath
			// Create the directory using Core.Init to set up .gitignore
			core := beancore.New(beansDir, nil)
			if err := core.Init(); err != nil {
				if initJSON {
					return output.Error(output.ErrFileError, err.Error())
				}
				return fmt.Errorf("failed to create directory: %w", err)
			}
			// Skip creating .totem.yml when --beans-path is explicit:
			// the path is already known, and writing a config to the parent
			// directory could pollute unrelated locations (e.g. /tmp).
		} else {
			// Use current working directory
			dir, err := os.Getwd()
			if err != nil {
				if initJSON {
					return output.Error(output.ErrFileError, err.Error())
				}
				return err
			}

			if err := beancore.Init(dir); err != nil {
				if initJSON {
					return output.Error(output.ErrFileError, err.Error())
				}
				return fmt.Errorf("failed to initialize: %w", err)
			}

			projectDir = dir
			beansDir = filepath.Join(dir, ".totem")
			dirName = filepath.Base(dir)

			// Create default config file with directory name as prefix
			// Config is saved at project root (not inside .totem/)
			defaultCfg := config.DefaultWithPrefix(dirName + "-")
			defaultCfg.Project.Name = dirName
			defaultCfg.SetConfigDir(projectDir)

			// Auto-detect the remote's default branch if we're in a git repo
			if baseRef, ok := gitutil.DefaultRemoteBranch(projectDir, "origin"); ok {
				defaultCfg.Worktree.BaseRef = baseRef
			}
			if err := defaultCfg.Save(projectDir); err != nil {
				if initJSON {
					return output.Error(output.ErrFileError, err.Error())
				}
				return fmt.Errorf("failed to create config: %w", err)
			}
		}

		if initJSON {
			return output.SuccessInit(beansDir)
		}

		fmt.Println("Initialized totem project")
		return nil
	},
}

func RegisterInitCmd(root *cobra.Command) {
	initCmd.Flags().BoolVar(&initJSON, "json", false, "Output as JSON")
	root.AddCommand(initCmd)
}
